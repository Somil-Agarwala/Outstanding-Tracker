import { useState, useMemo } from 'react'
import { useWatchlist } from '../../hooks/useWatchlist'
import { fmtCurrency, fmtDate, fmtDateShort, RISK } from '../../lib/utils'
import { X, AlertTriangle, FileText, Clock, IndianRupee, ChevronRight } from 'lucide-react'

/* ── Risk score bar ── */
function RiskBar({ score }) {
  const pct   = Math.min(100, Math.max(0, score ?? 0))
  const color = pct >= 75 ? 'bg-red-500'
              : pct >= 50 ? 'bg-orange-400'
              : pct >= 25 ? 'bg-amber-400'
              : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] font-semibold w-6 text-right text-slate-500">{pct}</span>
    </div>
  )
}

/* ── Detail drawer ── */
function DealerDrawer({ dealer, onClose, getDealerDetail, toggleWatchlist }) {
  const [tab,      setTab]      = useState('invoices')
  const [detail,   setDetail]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [toggling, setToggling] = useState(false)
  const rc = RISK[dealer.risk_level] ?? RISK.low

  async function loadTab(t) {
    setTab(t)
    if (!detail) {
      setLoading(true)
      const d = await getDealerDetail(dealer.id)
      setDetail(d)
      setLoading(false)
    }
  }

  // load invoices on open
  useState(() => { loadTab('invoices') }, [])

  async function handleToggle() {
    setToggling(true)
    try {
      const reason = dealer.watchlist ? '' : `Risk score ${dealer.risk_score} — manual flag`
      await toggleWatchlist(dealer.id, !dealer.watchlist, reason)
      onClose()
    } catch (e) { alert(e.message) } finally { setToggling(false) }
  }

  const TABS = [
    { key: 'invoices', label: 'Invoices'        },
    { key: 'payments', label: 'Payment History' },
    { key: 'logs',     label: 'Watchlist Logs'  },
  ]

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[540px] bg-white flex flex-col shadow-2xl overflow-hidden">

        {/* header */}
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-800">{dealer.name}</h2>
                <span className={`badge ${rc.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                  {rc.label}
                </span>
                {dealer.watchlist && <span className="badge badge-red">⚠ Watchlisted</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {dealer.town} · {dealer.psr_name} · {dealer.mobile ?? 'No mobile'}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
              <X size={17} />
            </button>
          </div>

          {/* risk bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Risk Score</span><span>/ 100</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (dealer.risk_score ?? 0) >= 75 ? 'bg-red-500'
                  : (dealer.risk_score ?? 0) >= 50 ? 'bg-orange-400'
                  : (dealer.risk_score ?? 0) >= 25 ? 'bg-amber-400'
                  : 'bg-emerald-400'
                }`}
                style={{ width: `${dealer.risk_score ?? 0}%` }}
              />
            </div>
          </div>

          {/* stat chips */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Total Invoices', value: dealer.total_invoices ?? 0,                                Icon: FileText,     danger: false },
              { label: 'Times Overdue',  value: dealer.overdue_count ?? 0,                                Icon: AlertTriangle,danger: (dealer.overdue_count ?? 0) > 0 },
              { label: 'Avg Delay',      value: `${Number(dealer.avg_delay_days ?? 0).toFixed(0)}d`,      Icon: Clock,        danger: Number(dealer.avg_delay_days ?? 0) > 15 },
              { label: 'Overdue Amt',    value: fmtCurrency(dealer.total_overdue_amount ?? 0),            Icon: IndianRupee,  danger: Number(dealer.total_overdue_amount ?? 0) > 0 },
            ].map(({ label, value, danger }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${danger ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className={`text-sm font-bold ${danger ? 'text-red-700' : 'text-slate-700'}`}>{value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* toggle button */}
          <button
            onClick={handleToggle} disabled={toggling}
            className={`mt-4 w-full text-xs font-semibold py-2 rounded-xl border transition-colors ${
              dealer.watchlist
                ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                : 'border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100'
            }`}
          >
            {toggling ? '…' : dealer.watchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          </button>
        </div>

        {/* tabs */}
        <div className="flex shrink-0 border-b border-slate-100">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => loadTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* tab content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* invoices */}
          {!loading && tab === 'invoices' && detail && (
            detail.invoices.length === 0
              ? <p className="text-center text-slate-400 py-10 text-xs">No invoices</p>
              : detail.invoices.map(inv => {
                  const isPaid    = Number(inv.balance) <= 0
                  const isOverdue = !isPaid && inv.due_date && new Date(inv.due_date) < new Date()
                  const delayDays = isOverdue ? Math.floor((new Date() - new Date(inv.due_date)) / 86400000) : 0
                  return (
                    <div key={inv.id}
                      className={`rounded-xl border p-4 ${
                        isOverdue ? 'border-red-200 bg-red-50/50'
                        : isPaid  ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-slate-100'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-700">{inv.invoice_number}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Invoiced {fmtDate(inv.invoice_date)} · Due {fmtDate(inv.due_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${isOverdue ? 'text-red-600' : isPaid ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {fmtCurrency(inv.balance)}
                          </p>
                          {isOverdue && <p className="text-[10px] text-red-400">{delayDays}d overdue</p>}
                          {isPaid    && <p className="text-[10px] text-emerald-500">Paid</p>}
                        </div>
                      </div>
                      {(inv.calling_remarks_1 || inv.calling_remarks_2) && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5">
                          {inv.calling_remarks_1 && <p className="text-[10px] text-slate-400">💬 {inv.calling_remarks_1}</p>}
                          {inv.calling_remarks_2 && <p className="text-[10px] text-slate-400">💬 {inv.calling_remarks_2}</p>}
                        </div>
                      )}
                    </div>
                  )
                })
          )}

          {/* payment history */}
          {!loading && tab === 'payments' && detail && (
            detail.payments.length === 0
              ? <p className="text-center text-slate-400 py-10 text-xs">No payment history</p>
              : detail.payments.map(ph => (
                  <div key={ph.id}
                    className={`rounded-xl border p-4 flex justify-between items-center ${
                      ph.was_overdue ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/30'
                    }`}>
                    <div>
                      <p className="font-semibold text-xs text-slate-700">{fmtCurrency(ph.amount)} received</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(ph.payment_date)}</p>
                      {ph.notes && <p className="text-[10px] text-slate-400 mt-1">{ph.notes}</p>}
                    </div>
                    {ph.was_overdue
                      ? <span className="badge badge-red">{ph.delay_days}d late</span>
                      : <span className="badge badge-green">On time</span>}
                  </div>
                ))
          )}

          {/* watchlist logs */}
          {!loading && tab === 'logs' && detail && (
            detail.logs.length === 0
              ? <p className="text-center text-slate-400 py-10 text-xs">No watchlist activity</p>
              : detail.logs.map(lg => (
                  <div key={lg.id} className="rounded-xl border border-slate-100 p-4 flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 capitalize">{lg.action} watchlist</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(lg.created_at)}</p>
                      {lg.reason && <p className="text-[10px] text-slate-500 mt-1">Reason: {lg.reason}</p>}
                    </div>
                    {lg.risk_level && (
                      <span className={`badge ${RISK[lg.risk_level]?.cls ?? ''}`}>
                        {RISK[lg.risk_level]?.label ?? lg.risk_level}
                      </span>
                    )}
                  </div>
                ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Watchlist Page ── */
export default function WatchlistPage() {
  const { dealers, loading, toggleWatchlist, getDealerDetail } = useWatchlist()
  const [riskFilter,     setRiskFilter]     = useState('')
  const [watchlistOnly,  setWatchlistOnly]  = useState(false)
  const [sortBy,         setSortBy]         = useState('risk_score')
  const [selectedDealer, setSelectedDealer] = useState(null)

  const riskCounts = useMemo(() => ({
    critical: dealers.filter(d => d.risk_level === 'critical').length,
    high:     dealers.filter(d => d.risk_level === 'high').length,
    medium:   dealers.filter(d => d.risk_level === 'medium').length,
    low:      dealers.filter(d => d.risk_level === 'low').length,
  }), [dealers])

  const filtered = useMemo(() =>
    dealers
      .filter(d => !riskFilter    || d.risk_level === riskFilter)
      .filter(d => !watchlistOnly || d.watchlist)
      .sort((a, b) => Number(b[sortBy] ?? 0) - Number(a[sortBy] ?? 0))
  , [dealers, riskFilter, watchlistOnly, sortBy])

  const RISK_CHIPS = [
    { level: 'critical', label: 'Critical', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'     },
    { level: 'high',     label: 'High',     bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700'  },
    { level: 'medium',   label: 'Medium',   bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700'   },
    { level: 'low',      label: 'Low',      bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700' },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* header */}
      <div className="shrink-0 px-5 py-3 bg-white border-b border-slate-100">
        <h1 className="text-sm font-bold text-slate-800">Risk & Watchlist</h1>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Auto-scored from payment history · click any dealer to see full history
        </p>

        {/* risk chips */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {RISK_CHIPS.map(r => {
            const active = riskFilter === r.level
            return (
              <button
                key={r.level}
                onClick={() => setRiskFilter(active ? '' : r.level)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  active ? `${r.bg} ${r.border}` : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <p className={`text-xl font-bold ${active ? r.text : 'text-slate-700'}`}>
                  {riskCounts[r.level]}
                </p>
                <p className={`text-[10px] font-semibold mt-0.5 ${active ? r.text : 'text-slate-400'}`}>
                  {r.label} Risk
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* filter bar */}
      <div className="shrink-0 px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox" checked={watchlistOnly}
            onChange={e => setWatchlistOnly(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Watchlisted only
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">Sort by</span>
          <select className="input w-44" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="risk_score">Risk Score</option>
            <option value="overdue_count">Overdue Count</option>
            <option value="avg_delay_days">Avg Delay Days</option>
            <option value="total_overdue_amount">Overdue Amount</option>
          </select>
        </div>
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {/* STICKY columns: Dealer, Town, Company */}
                <th className="th left-0 z-20" style={{ position: 'sticky', background: '#f8fafc', minWidth: 140 }}>Dealer</th>
                <th className="th left-36 z-20" style={{ position: 'sticky', background: '#f8fafc', minWidth: 100 }}>Town</th>
                <th className="th" style={{ position: 'sticky', left: 232, zIndex: 20, background: '#f8fafc', minWidth: 110 }}>Company</th>
                {/* scrollable columns */}
                {['PSR','Mobile','Risk Score','Level','Total Inv','Times Overdue',
                  'Avg Delay','Overdue Amt','Open Balance','Last Payment',
                  'Watchlist','Remarks',''].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} className="td text-center text-slate-400 py-16">No dealers found</td>
                </tr>
              ) : filtered.map(d => {
                const rc = RISK[d.risk_level] ?? RISK.low
                return (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDealer(d)}
                    className={`cursor-pointer transition-colors ${d.watchlist ? 'bg-red-50/20' : ''}`}
                  >
                    {/* STICKY: Dealer */}
                    <td className="td font-semibold text-slate-700"
                      style={{ position: 'sticky', left: 0, zIndex: 10, background: 'inherit', minWidth: 140 }}>
                      <div className="flex items-center gap-1">
                        {d.watchlist && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                        <span className="text-[11px]">{d.name}</span>
                      </div>
                    </td>
                    {/* STICKY: Town */}
                    <td className="td text-slate-400 text-[11px]"
                      style={{ position: 'sticky', left: 144, zIndex: 10, background: 'inherit', minWidth: 100 }}>
                      {d.town}
                    </td>
                    {/* STICKY: Company */}
                    <td className="td text-slate-400 text-[11px]"
                      style={{ position: 'sticky', left: 232, zIndex: 10, background: 'inherit', minWidth: 110 }}>
                      {d.company_name}
                    </td>

                    {/* scrollable */}
                    <td className="td text-slate-400 text-[11px]">{d.psr_name}</td>
                    <td className="td font-mono text-[10px] text-slate-300">{d.mobile ?? '—'}</td>
                    <td className="td w-28"><RiskBar score={d.risk_score ?? 0} /></td>
                    <td className="td">
                      <span className={`badge ${rc.cls}`}>
                        <span className={`w-1 h-1 rounded-full ${rc.dot}`} />
                        {rc.label}
                      </span>
                    </td>
                    <td className="td text-center text-slate-500">{d.total_invoices ?? 0}</td>
                    <td className="td text-center">
                      <span className={(d.overdue_count ?? 0) > 0 ? 'font-bold text-red-600' : 'text-slate-300'}>
                        {d.overdue_count ?? 0}
                      </span>
                    </td>
                    <td className="td text-center">
                      <span className={Number(d.avg_delay_days ?? 0) > 15 ? 'font-bold text-orange-600' : 'text-slate-500'}>
                        {Number(d.avg_delay_days ?? 0).toFixed(0)}d
                      </span>
                    </td>
                    <td className="td text-right">
                      <span className={Number(d.total_overdue_amount ?? 0) > 0 ? 'font-bold text-red-600' : 'text-slate-300'}>
                        {fmtCurrency(d.total_overdue_amount ?? 0)}
                      </span>
                    </td>
                    <td className="td text-right font-bold text-slate-700">{fmtCurrency(d.total_balance ?? 0)}</td>
                    <td className="td text-slate-400 text-[10px]">{fmtDateShort(d.last_payment_date)}</td>
                    <td className="td">
                      {d.watchlist
                        ? <span className="badge badge-red">⚠ Yes</span>
                        : <span className="badge badge-gray">—</span>}
                    </td>
                    <td className="td max-w-[130px]">
                      <p className="text-[10px] text-slate-400 truncate">{d.watchlist_reason || '—'}</p>
                    </td>
                    <td className="td">
                      <ChevronRight size={13} className="text-slate-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedDealer && (
        <DealerDrawer
          dealer={selectedDealer}
          onClose={() => setSelectedDealer(null)}
          getDealerDetail={getDealerDetail}
          toggleWatchlist={toggleWatchlist}
        />
      )}
    </div>
  )
}
