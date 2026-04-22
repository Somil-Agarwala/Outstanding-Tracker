import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useInvoices }  from '../hooks/useInvoices'
import { useWatchlist } from '../hooks/useWatchlist'
import { useAuth }      from '../hooks/useAuth'
import { fmtCurrency, fmtDate, callStatus, RISK } from '../lib/utils'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts'

/* ── KPI card ── */
function KPI({ label, value, sub, color }) {
  const colors = {
    indigo: { bar: '#6366f1', bg: '#eef2ff', text: '#4338ca' },
    red:    { bar: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
    amber:  { bar: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
    pink:   { bar: '#ec4899', bg: '#fdf2f8', text: '#be185d' },
    green:  { bar: '#10b981', bg: '#ecfdf5', text: '#065f46' },
    slate:  { bar: '#64748b', bg: '#f8fafc', text: '#334155' },
  }
  const c = colors[color] ?? colors.slate
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div
        className="self-start h-1 w-8 rounded-full"
        style={{ background: c.bar }}
      />
      <p
        className="text-xl font-bold leading-none"
        style={{ color: c.text }}
      >
        {value}
      </p>
      <div>
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Section header ── */
function SectionHead({ title, linkTo, linkLabel }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h2>
      {linkTo && (
        <Link
          to={linkTo}
          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
        >
          {linkLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const { invoices, loading } = useInvoices()
  const { dealers } = useWatchlist()

  const stats = useMemo(() => {
    const totalBalance   = invoices.reduce((s, i) => s + Number(i.balance || 0), 0)
    const totalCollected = invoices.reduce((s, i) => s + Number(i.payment_received || 0), 0)
    const totalPDC       = invoices.reduce((s, i) => s + Number(i.pdc_amount || 0), 0)
    const overdueInvs    = invoices.filter(i => callStatus(i) === 'overdue')
    const overdueAmt     = overdueInvs.reduce((s, i) => s + Number(i.balance || 0), 0)
    const dueTodayCount  = invoices.filter(i => callStatus(i) === 'due_today').length
    const callDueCount   = invoices.filter(i => callStatus(i) === 'call_due').length
    const watchlistCount = dealers.filter(d => d.watchlist).length

    // Chart: outstanding + overdue by company
    const byCompany = {}
    invoices.forEach(inv => {
      const k = inv.company_name || 'Unknown'
      if (!byCompany[k]) byCompany[k] = { name: k, outstanding: 0, overdue: 0 }
      byCompany[k].outstanding += Number(inv.balance || 0)
      if (callStatus(inv) === 'overdue') byCompany[k].overdue += Number(inv.balance || 0)
    })
    const chartData = Object.values(byCompany)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 8)
      .map(d => ({
        ...d,
        name: d.name.length > 11 ? d.name.slice(0, 11) + '…' : d.name,
      }))

    // Location-wise summary
    const byLocation = {}
    invoices.forEach(inv => {
      const l = inv.location_name || 'Unknown'
      if (!byLocation[l]) byLocation[l] = { outstanding: 0, overdue: 0, collected: 0, count: 0, callDue: 0 }
      byLocation[l].outstanding += Number(inv.balance || 0)
      byLocation[l].collected   += Number(inv.payment_received || 0)
      byLocation[l].count++
      if (callStatus(inv) === 'overdue') byLocation[l].overdue += Number(inv.balance || 0)
      if (callStatus(inv) === 'call_due' || callStatus(inv) === 'due_today') byLocation[l].callDue++
    })
    const locationRows = Object.entries(byLocation).sort((a, b) => b[1].outstanding - a[1].outstanding)

    return {
      totalBalance, totalCollected, totalPDC,
      overdueInvs, overdueAmt,
      dueTodayCount, callDueCount, watchlistCount,
      chartData, locationRows,
    }
  }, [invoices, dealers])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const watchlisted = dealers.filter(d => d.watchlist)

  return (
    <div className="p-5 space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin ? 'All locations' : profile?.locations?.name} ·{' '}
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <KPI label="Total Balance"   value={fmtCurrency(stats.totalBalance)}                                      color="indigo" />
        <KPI label="Overdue"         value={fmtCurrency(stats.overdueAmt)}   sub={`${stats.overdueInvs.length} invoices`} color="red"    />
        <KPI label="Due Today"       value={stats.dueTodayCount}             sub="invoices due"                   color="amber"  />
        <KPI label="Call Alerts"     value={stats.callDueCount}              sub="due tomorrow"                   color="pink"   />
        <KPI label="Collected"       value={fmtCurrency(stats.totalCollected)}                                    color="green"  />
        <KPI label="Total PDC"       value={fmtCurrency(stats.totalPDC)}     sub="post dated cheques"             color="slate"  />
        <KPI label="Watchlist"       value={stats.watchlistCount}            sub="flagged dealers"                color="red"    />
      </div>

      {/* ── Chart + Watchlist ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Company bar chart */}
        <div className="card lg:col-span-2 overflow-hidden">
          <SectionHead title="Outstanding by Company" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={stats.chartData} barSize={16} barGap={3}>
                <XAxis
                  dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v =>
                    v >= 100000 ? '₹' + (v / 100000).toFixed(0) + 'L'
                    : v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'K'
                    : '₹' + v
                  }
                />
                <Tooltip
                  formatter={(v, name) => [
                    fmtCurrency(v),
                    name === 'outstanding' ? 'Outstanding' : 'Overdue',
                  ]}
                  contentStyle={{
                    fontSize: 11, borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="outstanding" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="overdue"     fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" /> Outstanding
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> Overdue
              </span>
            </div>
          </div>
        </div>

        {/* Watchlist panel */}
        <div className="card overflow-hidden">
          <SectionHead title="Watchlist" linkTo="/watchlist" linkLabel="View all" />
          <div className="divide-y divide-slate-50">
            {watchlisted.slice(0, 6).map(d => {
              const rc = RISK[d.risk_level] || RISK.low
              return (
                <div key={d.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 mr-2">
                    <p className="text-xs font-semibold text-slate-700 truncate">{d.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{d.town} · {d.overdue_count} overdue</p>
                  </div>
                  <span className={`badge shrink-0 ${rc.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                    {rc.label}
                  </span>
                </div>
              )
            })}
            {watchlisted.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No watchlist entries</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Location-wise summary ── */}
      {stats.locationRows.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHead title="Location-wise Summary" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Location', 'Invoices', 'Outstanding', 'Overdue', 'Collected', 'Call Alerts'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.locationRows.map(([loc, d]) => (
                  <tr key={loc} className="hover:bg-blue-50/50 transition-colors">
                    <td className="td font-bold text-indigo-600">{loc}</td>
                    <td className="td text-center text-slate-600">{d.count}</td>
                    <td className="td text-right font-bold text-slate-800">{fmtCurrency(d.outstanding)}</td>
                    <td className="td text-right">
                      <span className={d.overdue > 0 ? 'font-bold text-red-600' : 'text-slate-300'}>
                        {fmtCurrency(d.overdue)}
                      </span>
                    </td>
                    <td className="td text-right font-semibold text-emerald-600">{fmtCurrency(d.collected)}</td>
                    <td className="td text-center">
                      {d.callDue > 0
                        ? <span className="badge badge-pink">{d.callDue} calls</span>
                        : <span className="text-slate-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Overdue invoices table ── */}
      {stats.overdueInvs.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHead title="Overdue Invoices" linkTo="/invoices" linkLabel="All invoices" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Invoice No', 'Stockist', 'Town', 'PSR', 'Balance', 'Due Date', 'Overdue By'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.overdueInvs.slice(0, 10).map(inv => {
                  const delay = Math.floor((new Date() - new Date(inv.due_date)) / 86400000)
                  return (
                    <tr key={inv.id}>
                      <td className="td font-mono text-[10px] font-semibold text-indigo-700">
                        {inv.invoice_number}
                      </td>
                      <td className="td">
                        <span className="font-semibold text-slate-700 text-xs">{inv.stockist_name}</span>
                        {inv.watchlist && (
                          <span className="ml-1.5 badge badge-red">
                            <AlertTriangle size={9} /> watchlist
                          </span>
                        )}
                      </td>
                      <td className="td text-slate-400">{inv.town}</td>
                      <td className="td text-slate-400">{inv.psr_name}</td>
                      <td className="td text-right font-bold text-red-600">
                        {fmtCurrency(inv.balance)}
                      </td>
                      <td className="td text-slate-400">{fmtDate(inv.due_date)}</td>
                      <td className="td">
                        <span className="badge badge-red">{delay}d late</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
