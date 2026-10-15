import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useFinance } from '../../hooks/useFinance'
import { effectiveRate, breakevenDays } from '../../lib/profit'
import { fmtCurrency } from '../../lib/utils'

const KINDS = [
  { key: 'cc',    label: 'Cash credit (CC)' },
  { key: 'od',    label: 'Overdraft (OD)' },
  { key: 'term',  label: 'Term loan' },
  { key: 'other', label: 'Other' },
]
const kindLabel = k => KINDS.find(x => x.key === k)?.label ?? k

const fmtPct = n => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')}%`

/* ── Loan modal (add & edit) ── */
function LoanModal({ loan, onSave, onClose }) {
  const editing = !!loan?.id
  const [f, setF] = useState({
    name:     loan?.name     ?? '',
    kind:     loan?.kind     ?? 'cc',
    amount:   String(loan?.amount   ?? ''),
    rate_pct: String(loan?.rate_pct ?? ''),
    notes:    loan?.notes    ?? '',
    active:   loan?.active   ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const s = k => v => setF(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    const rate = Number(f.rate_pct)
    const amount = Number(f.amount || 0)
    if (!f.name.trim()) { setErr('Give the loan a name, e.g. "SBI CC limit"'); return }
    if (!(rate > 0) || rate > 60) { setErr('Interest rate should be a yearly % between 0 and 60'); return }
    if (!(amount >= 0)) { setErr('Amount cannot be negative'); return }
    setBusy(true)
    try {
      await onSave({ name: f.name.trim(), kind: f.kind, amount, rate_pct: rate, notes: f.notes.trim() || null, active: f.active }, loan?.id ?? null)
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-semibold">{editing ? 'Edit Loan' : 'Add Loan'}</h3>
          <button onClick={onClose} aria-label="Close"><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Name *</label>
            <input className="input" value={f.name} onChange={e => s('name')(e.target.value)} placeholder="e.g. SBI CC limit" /></div>
          <div><label className="label">Type</label>
            <select className="input" value={f.kind} onChange={e => s('kind')(e.target.value)}>
              {KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount in use (₹)</label>
              <input type="number" min="0" step="1" className="input" value={f.amount}
                onChange={e => s('amount')(e.target.value)} placeholder="e.g. 5000000" /></div>
            <div><label className="label">Interest rate (% a year) *</label>
              <input type="number" min="0" max="60" step="0.01" className="input" value={f.rate_pct}
                onChange={e => s('rate_pct')(e.target.value)} placeholder="e.g. 10.5" /></div>
          </div>
          <p className="text-[11.5px] text-faint leading-relaxed">
            With more than one loan, the P&L uses their average rate weighted by the amount in use, so a bigger loan counts for more.
          </p>
          <div><label className="label">Notes</label>
            <input className="input" value={f.notes} onChange={e => s('notes')(e.target.value)} placeholder="Optional" /></div>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={f.active} onChange={e => s('active')(e.target.checked)} />
            Counts towards the interest rate
          </label>
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">
              {busy && <Loader2 size={13} className="animate-spin" />} {editing ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Margins & Loans card for Master Data ── */
export default function FinanceSection({ companies }) {
  const { finance, loans, loading, error, saveMargins, saveLoan, deleteLoan } = useFinance({ withHistory: false })
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [loanModal, setLoanModal] = useState(null)

  useEffect(() => {
    const byCo = Object.fromEntries(finance.map(r => [r.company_id, r]))
    setDraft(Object.fromEntries(companies.map(c => [c.id, {
      margin_pct:        String(byCo[c.id]?.margin_pct ?? ''),
      cost_to_serve_pct: String(byCo[c.id]?.cost_to_serve_pct ?? ''),
    }])))
  }, [finance, companies])

  const { rate, used, count } = useMemo(() => effectiveRate(loans), [loans])
  const saved = useMemo(() => Object.fromEntries(finance.map(r => [r.company_id, r])), [finance])
  const dirty = companies.some(c => {
    const d = draft[c.id], s = saved[c.id]
    if (!d) return false
    return String(d.margin_pct) !== String(s?.margin_pct ?? '') || String(d.cost_to_serve_pct) !== String(s?.cost_to_serve_pct ?? '')
  })

  const setRow = (id, k, v) => setDraft(p => ({ ...p, [id]: { ...p[id], [k]: v } }))

  async function onSaveMargins() {
    setMsg(null)
    const rows = []
    for (const c of companies) {
      const d = draft[c.id]
      if (!d || (d.margin_pct === '' && d.cost_to_serve_pct === '' && !saved[c.id])) continue
      const m = Number(d.margin_pct || 0), k = Number(d.cost_to_serve_pct || 0)
      if (!(m >= 0 && m <= 100) || !(k >= 0 && k <= 100)) {
        setMsg({ tone: 'bad', text: `${c.name}: percentages must be between 0 and 100` }); return
      }
      rows.push({ company_id: c.id, margin_pct: m, cost_to_serve_pct: k })
    }
    setSaving(true)
    try {
      await saveMargins(rows)
      setMsg({ tone: 'good', text: 'Margins saved' })
    } catch (e) {
      setMsg({ tone: 'bad', text: e.message })
    } finally { setSaving(false) }
  }

  async function onDeleteLoan(l) {
    if (!window.confirm(`Delete "${l.name}"? To keep it on record but stop counting it, untick "Counts towards the interest rate" instead.`)) return
    try { await deleteLoan(l.id) } catch (e) { window.alert('Could not delete: ' + e.message) }
  }

  async function toggleLoan(l) {
    try { await saveLoan({ active: !l.active }, l.id) } catch (e) { window.alert('Could not update: ' + e.message) }
  }

  if (loading) return (
    <div className="card p-5 lg:col-span-2 flex items-center gap-2 text-sm text-faint">
      <Loader2 size={14} className="animate-spin" /> Loading margins and loans…
    </div>
  )

  if (error) return (
    <div className="card p-5 lg:col-span-2">
      <h2 className="text-sm font-semibold text-gray-700">Margins & Loans</h2>
      <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
    </div>
  )

  return (
    <div className="card lg:col-span-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Margins & Loans <span className="text-gray-400 font-normal ml-1">· used by Party P&L</span></h2>
        <p className="text-xs text-faint mt-0.5">
          {rate == null
            ? 'Add at least one loan so the P&L can charge interest on the money dealers hold.'
            : `Interest rate used: ${fmtPct(rate)} a year, from ${count} loan${count === 1 ? '' : 's'}${used > 0 ? ` (${fmtCurrency(used)} in use)` : ''}. That is ${fmtCurrency(100000 * rate / 100 / 365)} a day on every ₹1 lakh a dealer holds.`}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr]">
        {/* Margins */}
        <div className="xl:border-r border-gray-100">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Margin by company</h3>
            <button type="button" onClick={onSaveMargins} disabled={!dirty || saving} className="btn-primary text-xs min-h-[34px]">
              {saving && <Loader2 size={12} className="animate-spin" />} Save margins
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">Company</th>
                <th className="th">Margin %</th>
                <th className="th">Cost to serve %</th>
                <th className="th text-right">Net %</th>
                <th className="th text-right">Loss after</th>
              </tr></thead>
              <tbody>
                {companies.map(c => {
                  const d = draft[c.id] ?? { margin_pct: '', cost_to_serve_pct: '' }
                  const net = (Number(d.margin_pct) || 0) - (Number(d.cost_to_serve_pct) || 0)
                  const be = breakevenDays(net, rate)
                  const unset = d.margin_pct === ''
                  return (
                    <tr key={c.id}>
                      <td className="td font-medium text-sm">{c.name}</td>
                      <td className="td w-28">
                        <input type="number" min="0" max="100" step="0.01" className="input min-h-[32px]" aria-label={`${c.name} margin %`}
                          value={d.margin_pct} placeholder="e.g. 6" onChange={e => setRow(c.id, 'margin_pct', e.target.value)} />
                      </td>
                      <td className="td w-28">
                        <input type="number" min="0" max="100" step="0.01" className="input min-h-[32px]" aria-label={`${c.name} cost to serve %`}
                          value={d.cost_to_serve_pct} placeholder="e.g. 3" onChange={e => setRow(c.id, 'cost_to_serve_pct', e.target.value)} />
                      </td>
                      <td className={`td text-right font-mono ${net <= 0 && !unset ? 'text-bad' : 'text-ink'}`}>{unset ? '—' : fmtPct(net)}</td>
                      <td className="td text-right text-xs text-muted whitespace-nowrap">
                        {unset ? <span className="text-warn">not set</span> : be == null ? '—' : be === 0 ? <span className="text-bad">already</span> : `${Math.floor(be)} days`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11.5px] text-faint leading-relaxed">
            Margin is what you earn on the bill value. Cost to serve is salaries, PSRs, delivery and godown as a % of sales.
            &ldquo;Loss after&rdquo; is how many days a fully unpaid bill can stay out before interest wipes out the net margin.
          </p>
          {msg && <p className={`mx-5 mb-4 text-xs rounded-lg px-3 py-2 ${msg.tone === 'good' ? 'text-good bg-good-bg' : 'text-red-600 bg-red-50'}`}>{msg.text}</p>}
        </div>

        {/* Loans */}
        <div className="border-t xl:border-t-0 border-gray-100">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Loans <span className="normal-case font-normal text-gray-400">({loans.length})</span></h3>
            <button type="button" onClick={() => setLoanModal({})} className="btn-primary text-xs min-h-[34px]"><Plus size={12} /> Add loan</button>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">Loan</th>
                <th className="th text-right">In use</th>
                <th className="th text-right">Rate</th>
                <th className="th">Counts</th>
                <th className="th" />
              </tr></thead>
              <tbody>
                {loans.map(l => (
                  <tr key={l.id} className={l.active ? '' : 'opacity-60'}>
                    <td className="td">
                      <div className="font-medium text-sm">{l.name}</div>
                      <div className="text-[11px] text-faint">{kindLabel(l.kind)}{l.notes ? ` · ${l.notes}` : ''}</div>
                    </td>
                    <td className="td text-right font-mono">{fmtCurrency(l.amount)}</td>
                    <td className="td text-right font-mono">{fmtPct(l.rate_pct)}</td>
                    <td className="td"><input type="checkbox" checked={l.active} onChange={() => toggleLoan(l)} aria-label={`Count ${l.name} towards the rate`} /></td>
                    <td className="td whitespace-nowrap">
                      <button onClick={() => setLoanModal(l)} className="text-indigo-600 hover:text-indigo-800 mr-2" aria-label={`Edit ${l.name}`}><Pencil size={13} /></button>
                      <button onClick={() => onDeleteLoan(l)} className="text-gray-400 hover:text-red-600" aria-label={`Delete ${l.name}`}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-gray-400 py-8">No loans yet. Add your CC, OD or term loans.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {loanModal !== null && (
        <LoanModal loan={loanModal?.id ? loanModal : null} onSave={saveLoan} onClose={() => setLoanModal(null)} />
      )}
    </div>
  )
}
