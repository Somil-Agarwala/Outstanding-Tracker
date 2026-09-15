import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { useAuth } from '../hooks/useAuth'
import { fmtCurrency, fmtDate, riskOf } from '../lib/utils'
import { ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

/* Data now arrives pre-aggregated from fn_dashboard() — one RPC,
   ~4.5 KB, instead of 2,507 invoice rows at 2.6 MB. */

function KPI({ label, value, sub, color }) {
  const C = {
    indigo: { bar: '#6366f1', text: '#4338ca' },
    red:    { bar: '#ef4444', text: '#b91c1c' },
    amber:  { bar: '#f59e0b', text: '#b45309' },
    pink:   { bar: '#ec4899', text: '#be185d' },
    green:  { bar: '#10b981', text: '#065f46' },
    slate:  { bar: '#64748b', text: '#334155' },
  }[color] ?? { bar: '#64748b', text: '#334155' }
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="self-start h-0.5 w-8 rounded-full" style={{ background: C.bar }} />
      <p className="text-xl font-bold leading-none" style={{ color: C.text }}>{value}</p>
      <div>
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionHead({ title, linkTo, linkLabel, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
      <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h2>
      {right}
      {linkTo && (
        <Link to={linkTo}
          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
          {linkLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const {
    kpi, byCompany, byLocation, overdueTop, watchlistTop,
    watchlistCount, loading, error, refetch,
  } = useDashboard()

  if (loading && !kpi.invoice_count) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="card p-5 border-red-200">
          <p className="text-sm font-semibold text-red-700">Could not load dashboard</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button onClick={refetch} className="btn-secondary mt-3">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    )
  }

  const chartData = byCompany.map(d => ({
    name: d.name?.length > 11 ? d.name.slice(0, 11) + '…' : d.name,
    outstanding: Number(d.outstanding ?? 0),
    overdue:     Number(d.overdue ?? 0),
  }))

  return (
    <div className="p-5 space-y-5">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin ? 'All locations' : profile?.locations?.name} ·{' '}
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
            {' · '}{kpi.invoice_count ?? 0} invoices
          </p>
        </div>
        <button onClick={refetch} className="btn-secondary" title="Refresh">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <KPI label="Outstanding" value={fmtCurrency(kpi.outstanding)}    sub="unpaid balance"   color="indigo" />
        <KPI label="Overdue"     value={fmtCurrency(kpi.overdue_amount)} sub={`${kpi.overdue_count ?? 0} invoices`} color="red" />
        <KPI label="Due Today"   value={kpi.due_today ?? 0}              sub="invoices due"     color="amber" />
        <KPI label="Call Alerts" value={kpi.call_due ?? 0}               sub="due tomorrow"     color="pink" />
        <KPI label="Collected"   value={fmtCurrency(kpi.collected)}      sub="payments received" color="green" />
        <KPI label="Total PDC"   value={fmtCurrency(kpi.total_pdc)}      sub="post dated cheques" color="slate" />
        <KPI label="Watchlist"   value={watchlistCount}                  sub="flagged dealers"  color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="card lg:col-span-2 overflow-hidden">
          <SectionHead title="Unpaid Outstanding by Company" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chartData} barSize={16} barGap={3}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v =>
                    v >= 100000 ? '₹' + (v / 100000).toFixed(0) + 'L'
                    : v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K' : '₹' + v} />
                <Tooltip
                  formatter={(v, n) => [fmtCurrency(v), n === 'outstanding' ? 'Unpaid Balance' : 'Overdue']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="outstanding" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="overdue"     fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" /> Unpaid Balance
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> Overdue
              </span>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <SectionHead title="Watchlist" linkTo="/watchlist" linkLabel="View all" />
          <div className="divide-y divide-slate-50">
            {watchlistTop.map(d => {
              const rc = riskOf(d.risk_level)
              return (
                <div key={d.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 mr-2">
                    <p className="text-xs font-semibold text-slate-700 truncate">{d.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {d.town} · {d.overdue_count} overdue · score {d.risk_score}
                    </p>
                  </div>
                  <span className={`badge shrink-0 ${rc.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                    {rc.label}
                  </span>
                </div>
              )
            })}
            {watchlistTop.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No watchlist entries</p>
            )}
          </div>
        </div>
      </div>

      {byLocation.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHead title="Location-wise Summary" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Location','Invoices','Unpaid Outstanding','Overdue','Collected','Call Alerts'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byLocation.map(d => (
                  <tr key={d.name}>
                    <td className="td font-bold text-indigo-600">{d.name}</td>
                    <td className="td text-center text-slate-600">{d.invoices}</td>
                    <td className="td text-right font-bold text-slate-800">{fmtCurrency(d.outstanding)}</td>
                    <td className="td text-right">
                      <span className={Number(d.overdue) > 0 ? 'font-bold text-red-600' : 'text-slate-300'}>
                        {fmtCurrency(d.overdue)}
                      </span>
                    </td>
                    <td className="td text-right font-semibold text-emerald-600">{fmtCurrency(d.collected)}</td>
                    <td className="td text-center">
                      {Number(d.call_alerts) > 0
                        ? <span className="badge badge-pink">{d.call_alerts} calls</span>
                        : <span className="text-slate-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {overdueTop.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHead title="Largest Overdue Invoices" linkTo="/invoices" linkLabel="All invoices" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Invoice No','Stockist','Town','PSR','Unpaid Balance','Due Date','Overdue By'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overdueTop.map(inv => (
                  <tr key={inv.id}>
                    <td className="td font-mono text-[10px] font-bold text-indigo-700">{inv.invoice_number}</td>
                    <td className="td">
                      <span className="font-semibold text-slate-700 text-xs">{inv.stockist_name}</span>
                      {inv.watchlist && (
                        <span className="ml-1.5 badge badge-red">
                          <AlertTriangle size={9} /> watchlist
                        </span>
                      )}
                    </td>
                    <td className="td text-slate-400">{inv.town}</td>
                    <td className="td text-slate-400">{inv.psr_name ?? '—'}</td>
                    <td className="td text-right font-bold text-red-600">{fmtCurrency(inv.balance)}</td>
                    <td className="td text-slate-400">{fmtDate(inv.due_date)}</td>
                    <td className="td"><span className="badge badge-red">{inv.delay_days}d late</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
