import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Pencil, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import { invalidate } from '../../lib/cache'
import { useAuth } from '../../hooks/useAuth'
import { fmtCurrency, fmtDate } from '../../lib/utils'
import { dayNum, todayNum, riskBreakdown, severityWord, delayTrend } from '../../lib/ledger'
import { saveInvoice } from '../../lib/invoiceWrites'
import InvoiceModal from '../invoices/InvoiceModal'
import {
  Card, Kpi, Bar, Badge, riskMeta, PageLoading, PageError, EmptyState, AccessDenied, TONE,
} from '../ui'

function invoiceState(i, today) {
  const bal  = Number(i.balance) || 0
  const due  = dayNum(i.due_date)
  const paid = dayNum(i.payment_date)
  if (bal > 0) {
    if (due != null && due < today) return { label: `Overdue ${today - due}d`, tone: 'bad' }
    if (due === today)              return { label: 'Due today', tone: 'warn' }
    if (Number(i.payment_received) > 0) return { label: 'Partial', tone: 'warn' }
    return { label: 'Upcoming', tone: 'neutral' }
  }
  if (paid == null || due == null) return { label: 'Paid · no date', tone: 'neutral' }
  const late = paid - due
  if (late <= 0) return { label: 'Paid on time', tone: 'good' }
  return { label: `Paid +${late}d`, tone: late > 15 ? 'bad' : 'warn' }
}

const toneOf = p => (p >= 0.5 ? 'bad' : p >= 0.2 ? 'warn' : 'good')
const trendTone = d => (d <= 7 ? 'good' : d <= 21 ? 'warn' : 'bad')

function trendSentence(trend) {
  const vals = trend.map(t => t.avg)
  const recent = vals.slice(-3).filter(v => v != null)
  const before = vals.slice(0, -3).filter(v => v != null)
  if (!recent.length) return 'No bills fell due in the last three months.'
  const r = recent.reduce((a, b) => a + b, 0) / recent.length
  if (!before.length) return `About ${Math.round(r)} days late on average lately.`
  const b = before.reduce((x, y) => x + y, 0) / before.length
  if (r > b + 5) return 'Getting worse, not a one-off. Worth settling before the next load goes out.'
  if (r < b - 5) return 'Improving. Recent bills are being paid sooner than before.'
  return 'Steady. About the same as the months before.'
}

export default function DealerDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [dealer, setDealer]     = useState(null)
  const [invoices, setInvoices] = useState([])
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [tab, setTab]           = useState('invoices')
  const [editing, setEditing]   = useState(null)
  const [busy, setBusy]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, inv, lg] = await Promise.all([
        supabase.from('stockists')
          .select('*, psrs(name, mobile), companies(name), locations(name)')
          .eq('id', id).maybeSingle(),
        fetchAll(() => supabase.from('invoice_details').select('*')
          .eq('stockist_id', id).order('invoice_date', { ascending: false }).order('id')),
        supabase.from('watchlist_log').select('*').eq('stockist_id', id)
          .order('created_at', { ascending: false }).limit(20),
      ])
      if (s.error) throw s.error
      setDealer(s.data)
      setInvoices(inv)
      setLogs(lg.data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const today = todayNum()
  const stats = useMemo(() => {
    let owed = 0, credit = 0, maxLate = 0
    for (const i of invoices) {
      const bal = Number(i.balance) || 0
      if (bal > 0) {
        owed += bal
        const due = dayNum(i.due_date)
        if (due != null && due < today) maxLate = Math.max(maxLate, today - due)
      } else if (bal < 0) credit -= bal
    }
    return { owed, credit, maxLate, risk: riskBreakdown(invoices, dealer, today), trend: delayTrend(invoices) }
  }, [invoices, dealer, today])

  if (loading) return <PageLoading label="Loading this dealer's history…" />
  if (error)   return <PageError message={error} onRetry={load} />
  if (!dealer) {
    return (
      <div className="page"><Card>
        <AccessDenied what="This dealer is not yours to see"
          who="They may belong to another location, or have been removed. Ask your admin if you need access." />
      </Card></div>
    )
  }

  const risk = riskMeta(dealer.risk_level)
  const { owed, credit, maxLate, risk: rb, trend } = stats
  const payments = invoices.filter(i => Number(i.payment_received) > 0)
    .sort((a, b) => (dayNum(b.payment_date) ?? -1) - (dayNum(a.payment_date) ?? -1))
  const calls = invoices.filter(i => i.calling_remarks_1 || i.calling_remarks_2 || i.last_called_date)
  const maxTrend = Math.max(1, ...trend.map(t => t.avg ?? 0))
  const lateShare = rb.total ? rb.lateEvents / rb.total : 0
  const meta = [
    [dealer.town, dealer.locations?.name].filter(Boolean).join(', '),
    dealer.companies?.name,
    dealer.psrs?.name && `${dealer.psrs.name} handles them`,
    dealer.mobile,
    dealer.credit_days != null && `${dealer.credit_days} days credit`,
  ].filter(Boolean).join(' · ')

  async function toggleWatchlist() {
    const add = !dealer.watchlist
    const reason = add ? window.prompt('Why are you adding this dealer to the watchlist?', '') : ''
    if (add && reason === null) return
    setBusy(true)
    try {
      const { error: e1 } = await supabase.from('stockists')
        .update({ watchlist: add, watchlist_reason: reason || null }).eq('id', dealer.id)
      if (e1) throw e1
      await supabase.from('watchlist_log').insert({
        stockist_id: dealer.id, action: add ? 'added' : 'removed', reason: reason || null, performed_by: profile?.id,
      })
      invalidate('ledger')
      await load()
    } catch (e) {
      window.alert('Could not update the watchlist: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const TABS = [
    { key: 'invoices', label: 'All Invoices',    n: invoices.length },
    { key: 'payments', label: 'Payment History', n: payments.length },
    { key: 'calls',    label: 'Call Log',        n: calls.length + logs.length },
  ]

  return (
    <div className="page">
      <Link to="/dealers" className="inline-flex items-center gap-1 text-[13px] font-semibold -mb-2 w-fit">
        <ChevronLeft size={15} aria-hidden="true" /> All dealers
      </Link>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{dealer.name}</h1>
            <Badge tone={risk.tone}>{risk.label} Risk</Badge>
            {dealer.watchlist && <Badge tone="warn">Watchlist</Badge>}
          </div>
          <p className="mt-1.5 text-sm text-muted">{meta}</p>
          {dealer.watchlist && dealer.watchlist_reason && (
            <p className="mt-1 text-[12.5px] text-warn">Watchlist: {dealer.watchlist_reason}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {dealer.mobile && (
            <a href={`tel:${dealer.mobile.replace(/[^\d+]/g, '')}`} className="btn-primary min-h-[44px] px-5 text-sm">
              <Phone size={15} aria-hidden="true" /> Call Stockist
            </a>
          )}
          <button type="button" className="btn-secondary min-h-[44px]" onClick={toggleWatchlist} disabled={busy}>
            {dealer.watchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Kpi size={22} label="Outstanding" value={fmtCurrency(owed)} tone={maxLate ? 'bad' : 'neutral'}
          sub={maxLate ? `${maxLate} days past due` : owed ? 'nothing past due yet' : 'owes nothing'} />
        <Kpi size={22} label="Unallocated Credit" value={fmtCurrency(credit)} tone={credit ? 'warn' : 'neutral'}
          sub={credit ? 'overpaid on some bills — apply it' : 'no unapplied payments'} />
        <Kpi size={22} label="Late Payments" value={`${rb.lateEvents} of ${rb.total} bills`} tone={toneOf(lateShare)}
          sub={rb.total ? `${Math.round(lateShare * 100)}% of their bills` : 'no bills yet'} />
        <Kpi size={22} label="Average Delay" value={`${Math.round(rb.avgDelay)} days late`} tone={trendTone(rb.avgDelay)}
          sub="after the due date" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-[18px]">
        <Card className="px-4 md:px-6 py-[22px] flex flex-col min-w-0">
          <div role="tablist" className="flex gap-6 border-b border-line mb-4 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`pb-3 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? 'font-semibold text-brand border-brand' : 'font-medium text-faint border-transparent hover:text-ink'}`}>
                {t.label} <span className="text-xs">({t.n})</span>
              </button>
            ))}
          </div>

          {tab === 'invoices' && (invoices.length === 0
            ? <EmptyState title="No invoices yet" body="Nothing has been billed to this dealer." />
            : (
              <div className="overflow-auto max-h-[520px]">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-line text-left">
                      <th className="col-head pb-2.5 pr-3">Invoice No</th>
                      <th className="col-head pb-2.5 pr-3">Invoice Date</th>
                      <th className="col-head pb-2.5 pr-3">Due Date</th>
                      <th className="col-head pb-2.5 pr-3 text-right">Balance</th>
                      <th className="col-head pb-2.5 pr-3">Status</th>
                      <th className="col-head pb-2.5 w-8"><span className="sr-only-label">Edit</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(i => {
                      const st = invoiceState(i, today)
                      const bal = Math.max(0, Number(i.balance) || 0)
                      return (
                        <tr key={i.id} className="border-b border-line-soft">
                          <td className="py-[13px] pr-3 font-mono text-[12.5px] font-semibold text-brand">{i.invoice_number}</td>
                          <td className="py-[13px] pr-3 text-[12.5px] text-muted">{fmtDate(i.invoice_date)}</td>
                          <td className="py-[13px] pr-3 text-[12.5px] text-muted">{fmtDate(i.due_date)}</td>
                          <td className={`py-[13px] pr-3 text-right font-mono text-[13.5px] font-semibold ${bal ? 'text-ink' : 'text-dim'}`}>{bal ? fmtCurrency(bal) : '—'}</td>
                          <td className="py-[13px] pr-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                          <td className="py-[13px]">
                            <button type="button" onClick={() => setEditing(i)} aria-label={`Edit invoice ${i.invoice_number}`}
                              className="text-brand hover:text-brand-dark p-1"><Pencil size={14} /></button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === 'payments' && (payments.length === 0
            ? <EmptyState title="No payments recorded" body="Nothing has been received from this dealer yet." />
            : (
              <div className="overflow-auto max-h-[520px]">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-line text-left">
                      <th className="col-head pb-2.5 pr-3">Paid On</th>
                      <th className="col-head pb-2.5 pr-3">Invoice No</th>
                      <th className="col-head pb-2.5 pr-3 text-right">Amount</th>
                      <th className="col-head pb-2.5">Timing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(i => {
                      const due = dayNum(i.due_date), paid = dayNum(i.payment_date)
                      const t = paid == null ? { label: 'Date missing', tone: 'warn' }
                        : due == null ? { label: '—', tone: 'neutral' }
                        : paid <= due ? { label: 'On time', tone: 'good' }
                        : { label: `${paid - due} days late`, tone: paid - due > 15 ? 'bad' : 'warn' }
                      return (
                        <tr key={i.id} className="border-b border-line-soft">
                          <td className="py-[13px] pr-3 text-[12.5px] text-muted">{fmtDate(i.payment_date)}</td>
                          <td className="py-[13px] pr-3 font-mono text-[12.5px] font-semibold text-brand">{i.invoice_number}</td>
                          <td className="py-[13px] pr-3 text-right font-mono text-[13.5px] font-semibold text-ink">{fmtCurrency(i.payment_received)}</td>
                          <td className="py-[13px]"><Badge tone={t.tone}>{t.label}</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === 'calls' && (calls.length + logs.length === 0
            ? <EmptyState title="Never called" body="No call remarks have been recorded for this dealer. Add one from an invoice." />
            : (
              <ul className="flex flex-col">
                {calls.map(i => (
                  <li key={i.id} className="py-3 border-b border-line-soft">
                    <div className="flex items-center gap-2 text-xs text-faint">
                      <span className="font-mono font-semibold text-brand">{i.invoice_number}</span>
                      {i.last_called_date && <span>· called {fmtDate(i.last_called_date)}</span>}
                    </div>
                    {i.calling_remarks_1 && <p className="mt-1 text-[13px] text-ink">{i.calling_remarks_1}</p>}
                    {i.calling_remarks_2 && <p className="mt-0.5 text-[13px] text-muted">{i.calling_remarks_2}</p>}
                  </li>
                ))}
                {logs.map(l => (
                  <li key={l.id} className="py-3 border-b border-line-soft">
                    <div className="text-xs text-faint">{fmtDate(l.created_at?.slice(0, 10))} · watchlist</div>
                    <p className="mt-1 text-[13px] text-ink">{l.action === 'added' ? 'Added to watchlist' : 'Removed from watchlist'}{l.reason ? ` — ${l.reason}` : ''}</p>
                  </li>
                ))}
              </ul>
            ))}
        </Card>

        <div className="flex flex-col gap-[18px] min-w-0">
          <Card className="px-6 py-[22px]">
            <h2 className="h2">Risk Score Breakdown</h2>
            <p className="h2-sub mb-4">Four things decide their score of {dealer.risk_score ?? 0}. Here is where they stand on each.</p>
            <div className="flex flex-col gap-3.5">
              {rb.parts.map(p => {
                const tone = toneOf(p.pct)
                return (
                  <div key={p.key}>
                    <div className="flex justify-between items-baseline mb-1.5 gap-3">
                      <span className="text-[13px] text-ink">{p.label}</span>
                      <span className={`text-[12.5px] font-semibold whitespace-nowrap ${TONE[tone].text}`}>{severityWord(p.key, p.pct)}</span>
                    </div>
                    <Bar pct={p.pct} tone={tone} />
                    <div className="text-[11.5px] text-faint mt-1">{p.detail}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="px-6 py-[22px] flex-1">
            <h2 className="h2">Payment Trend</h2>
            <p className="h2-sub mb-4">Average days late, month by month (by due date).</p>
            <div className="flex items-end gap-[7px] h-[82px]" role="img"
              aria-label={trend.map(t => `${t.label}: ${t.avg == null ? 'no bills' : `${Math.round(t.avg)} days`}`).join(', ')}>
              {trend.map(t => (
                <div key={t.label} className="flex-1 h-full flex items-end" title={t.avg == null ? 'No bills due' : `${Math.round(t.avg)} days late on average`}>
                  {t.avg == null
                    ? <div className="w-full h-[3px] bg-line rounded" />
                    : <div className={`w-full rounded-t-[3px] ${TONE[trendTone(t.avg)].bar}`}
                        style={{ height: `${Math.max(6, (t.avg / maxTrend) * 100)}%` }} />}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {trend.map(t => <span key={t.label} className="flex-1 text-center text-[11.5px] text-faint">{t.label}</span>)}
            </div>
            <p className="mt-3.5 text-[12.5px] text-muted leading-relaxed">{trendSentence(trend)}</p>
          </Card>
        </div>
      </div>

      {editing && (
        <InvoiceModal
          invoice={editing}
          onSave={async (payload, invId) => { await saveInvoice(payload, invId, profile?.id); await load() }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
