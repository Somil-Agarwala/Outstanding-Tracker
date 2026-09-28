import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { useLedger } from '../../hooks/useLedger'
import { useAuth } from '../../hooks/useAuth'
import { fmtCurrency, fmtDate } from '../../lib/utils'
import { dayNum, todayNum } from '../../lib/ledger'
import { saveInvoice, deleteInvoice } from '../../lib/invoiceWrites'
import InvoiceModal from '../invoices/InvoiceModal'
import { Card, Badge, PageHeader, PageLoading, PageError, EmptyState, TONE } from '../ui'

function rawDate(iso) {
  if (!iso) return '—'
  return dayNum(iso) == null ? iso : fmtDate(iso)
}

function describe(h) {
  const d = h.duplicates, o = h.overpaid, v = h.invalidDates, m = h.missingPayDate
  const today = todayNum()
  const ex = d.examples.map(e => `${e.number} appears ${e.times === 2 ? 'twice' : `${e.times} times`}`)
  const futurePay = v.rows.filter(r => { const n = dayNum(r.payment_date); return n != null && n > today }).length
  const badYear = v.rows.length - futurePay
  return [
    {
      ...d, title: 'Duplicate Invoices', tone: 'bad',
      body: d.count
        ? `${ex.join(', ')}${d.groups.length > ex.length ? `, and ${d.groups.length - ex.length} other repeated number${d.groups.length - ex.length === 1 ? '' : 's'}` : ''}. Usually someone re-entered a bill instead of editing it.`
        : 'No dealer has the same invoice number twice.',
      impact: d.impact > 0 ? `adds ${fmtCurrency(d.impact)} that may not really be owed` : 'the repeats carry no balance, but inflate invoice counts',
    },
    {
      ...o, title: 'Overpaid Invoices', tone: 'bad',
      body: 'The payment recorded is bigger than the invoice. That extra is really their credit, but it sits stuck against one bill instead of reducing what they owe elsewhere.',
      impact: `hides ${fmtCurrency(o.impact)} of dealer credit`,
    },
    {
      ...v, title: 'Invalid Dates', tone: 'warn',
      body: [
        badYear > 0 && `${badYear} date${badYear === 1 ? ' has' : 's have'} an impossible year`,
        futurePay > 0 && `${futurePay} payment${futurePay === 1 ? ' falls' : 's fall'} in the future`,
      ].filter(Boolean).join(', ') + '. Usually extra digits typed by mistake.',
      impact: 'makes those dealers look better behaved than they are',
    },
    {
      ...m, title: 'Missing Payment Date', tone: 'warn',
      body: 'We know the money came in, but not when. So we cannot tell if they paid on time or two months late.',
      impact: 'their payment record looks cleaner than it is',
    },
  ]
}

function ReviewTable({ issue, onEdit, onDelete }) {
  const rows = issue.key === 'duplicates'
    ? [...issue.rows].sort((a, b) => `${a.stockist_name}${a.invoice_number}`.localeCompare(`${b.stockist_name}${b.invoice_number}`))
    : issue.rows
  return (
    <div className="mt-4 bg-white border border-line rounded-[10px] overflow-auto max-h-[420px]">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left border-b border-line">
            <th className="col-head py-2.5 px-3">Invoice No</th>
            <th className="col-head py-2.5 px-3">Stockist</th>
            <th className="col-head py-2.5 px-3">Invoice Date</th>
            <th className="col-head py-2.5 px-3 text-right">Net Amount</th>
            <th className="col-head py-2.5 px-3 text-right">Paid</th>
            <th className="col-head py-2.5 px-3">Paid On</th>
            <th className="col-head py-2.5 px-3 text-right">Balance</th>
            <th className="col-head py-2.5 px-3"><span className="sr-only-label">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-line-soft">
              <td className="py-2.5 px-3 font-mono text-xs font-semibold text-brand">{r.invoice_number}</td>
              <td className="py-2.5 px-3 text-[12.5px] text-ink">
                <Link to={`/dealers/${r.stockist_id}`} className="text-ink hover:text-brand">{r.stockist_name}</Link>
              </td>
              <td className="py-2.5 px-3 text-xs text-muted">{rawDate(r.invoice_date)}</td>
              <td className="py-2.5 px-3 text-right font-mono text-xs text-ink">{fmtCurrency(r.net_outstanding)}</td>
              <td className="py-2.5 px-3 text-right font-mono text-xs text-ink">{fmtCurrency(r.payment_received)}</td>
              <td className={`py-2.5 px-3 text-xs ${!r.payment_date && Number(r.payment_received) > 0 ? 'text-warn font-semibold' : 'text-muted'}`}>
                {r.payment_date ? rawDate(r.payment_date) : Number(r.payment_received) > 0 ? 'missing' : '—'}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono text-xs font-semibold ${Number(r.balance) < 0 ? 'text-bad' : 'text-ink'}`}>{fmtCurrency(r.balance)}</td>
              <td className="py-2.5 px-3 whitespace-nowrap text-right">
                <button type="button" onClick={() => onEdit(r)} aria-label={`Edit invoice ${r.invoice_number}`}
                  className="text-brand hover:text-brand-dark p-1.5"><Pencil size={14} /></button>
                {issue.key === 'duplicates' && (
                  <button type="button" onClick={() => onDelete(r)} aria-label={`Delete invoice ${r.invoice_number}`}
                    className="text-faint hover:text-bad p-1.5"><Trash2 size={14} /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataHealthPage() {
  const { profile } = useAuth()
  const { hash } = useLocation()
  const { health, loading, error, refetch } = useLedger()
  const [open, setOpen] = useState(hash ? hash.slice(1) : null)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (!open || loading) return
    document.getElementById(`issue-${open}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open, loading])

  if (loading) return <PageLoading label="Checking your entries…" />
  if (error)   return <PageError message={error} onRetry={refetch} />

  const issues = describe(health)
  const live = issues.filter(i => i.count > 0)

  async function remove(r) {
    if (!window.confirm(`Delete invoice ${r.invoice_number} for ${r.stockist_name}? This cannot be undone.`)) return
    try {
      await deleteInvoice(r.id)
      refetch()
    } catch (e) {
      window.alert(e.message)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Data Health"
        sub={health.total
          ? `${health.total} entries are quietly making your totals wrong. Each takes a minute or two to sort out.`
          : 'Every entry checks out. Your totals can be trusted.'}
        action={health.duplicates.count > 0 && (
          <button type="button" className="btn-primary min-h-[44px] px-5 text-sm" onClick={() => setOpen('duplicates')}>
            Resolve Duplicates ({health.duplicates.count})
          </button>
        )}
      />

      {live.length === 0 && <Card><EmptyState title="Nothing to fix" body="No duplicates, overpayments, impossible dates or missing payment dates." /></Card>}

      <div className="flex flex-col gap-[13px]">
        {live.map(i => (
          <div key={i.key} id={`issue-${i.key}`} className={`border rounded-xl px-5 md:px-[22px] py-5 scroll-mt-4 ${TONE[i.tone].box}`}>
            <div className="flex gap-4 md:gap-[18px] items-start md:items-center flex-col sm:flex-row">
              <div className={`font-mono text-[27px] font-semibold min-w-[52px] sm:text-center ${TONE[i.tone].text}`}>{i.count}</div>
              <div className="flex-1 min-w-0">
                <h3 className="m-0 text-[15px] font-semibold text-ink">{i.title}</h3>
                <p className="mt-1 text-[13px] text-muted leading-relaxed">{i.body}</p>
                <p className={`mt-1 text-[12.5px] leading-relaxed ${TONE[i.tone].text}`}><b>Impact:</b> {i.impact}</p>
              </div>
              <button type="button" className="btn-secondary" aria-expanded={open === i.key}
                onClick={() => setOpen(open === i.key ? null : i.key)}>
                {open === i.key ? 'Hide' : 'Review'}
              </button>
            </div>
            {open === i.key && <ReviewTable issue={i} onEdit={setEditing} onDelete={remove} />}
          </div>
        ))}
      </div>

      <Card className="px-6 py-[22px]">
        <h2 className="h2">Preventive Controls</h2>
        <p className="h2-sub mb-[18px]">Caught when someone types them, not weeks later. These now run in the invoice form.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['Duplicate Check on Entry', 'If this dealer already has that invoice number, the form says so before it saves.'],
            ['Date Range Validation', 'Impossible years and payments dated in the future are rejected as they are typed.'],
            ['Mandatory Payment Date', 'Enter an amount and the date becomes compulsory, so lateness is always measurable.'],
          ].map(([t, b]) => (
            <div key={t} className="px-[18px] py-4 bg-surface border border-line rounded-[10px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13.5px] font-semibold text-ink">{t}</div>
                <Badge tone="good">On</Badge>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </Card>

      {editing && (
        <InvoiceModal
          invoice={editing}
          onSave={async (payload, id) => { await saveInvoice(payload, id, profile?.id); refetch() }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
