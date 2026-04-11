import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useInvoices }  from '../hooks/useInvoices'
import { useWatchlist } from '../hooks/useWatchlist'
import { useAuth }      from '../hooks/useAuth'
import { fmtCurrency, fmtDate, callStatus, RISK } from '../lib/utils'
import {
  IndianRupee, AlertTriangle, Clock, Phone,
  CheckCircle2, ArrowRight, TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts'

function KPI({ label, value, sub, Icon, danger, warning, success }) {
  const color = danger  ? 'text-red-600 bg-red-50'
              : warning ? 'text-amber-600 bg-amber-50'
              : success ? 'text-emerald-600 bg-emerald-50'
              : 'text-indigo-600 bg-indigo-50'
  return (
    <div className="card p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={17} />
      </div>
      <p className="text-2xl font-semibold text-gray-900 leading-none">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const { invoices, loading } = useInvoices()
  const { dealers } = useWatchlist()

  const stats = useMemo(() => {
    const totalBalance    = invoices.reduce((s, i) => s + Number(i.balance || 0), 0)
    const totalCollected  = invoices.reduce((s, i) => s + Number(i.payment_received || 0), 0)
    const overdueInvs     = invoices.filter(i => callStatus(i) === 'overdue')
    const overdueAmt      = overdueInvs.reduce((s, i) => s + Number(i.balance || 0), 0)
    const dueTodayCount   = invoices.filter(i => callStatus(i) === 'due_today').length
    const callDueCount    = invoices.filter(i => callStatus(i) === 'call_due').length
    const watchlistCount  = dealers.filter(d => d.watchlist).length

    // chart: outstanding by company
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
      .map(d => ({ ...d, name: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name }))

    return { totalBalance, totalCollected, overdueInvs, overdueAmt, dueTodayCount, callDueCount, watchlistCount, chartData }
  }, [invoices, dealers])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isAdmin ? 'All locations' : profile?.locations?.name} ·{' '}
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPI label="Total balance"   value={fmtCurrency(stats.totalBalance)}  Icon={IndianRupee} />
        <KPI label="Overdue"         value={fmtCurrency(stats.overdueAmt)}    sub={`${stats.overdueInvs.length} invoices`} Icon={AlertTriangle} danger />
        <KPI label="Due today"       value={stats.dueTodayCount}              sub="invoices"     Icon={Clock}         warning />
        <KPI label="Call alerts"     value={stats.callDueCount}               sub="due tomorrow" Icon={Phone}         warning />
        <KPI label="Collected"       value={fmtCurrency(stats.totalCollected)} Icon={CheckCircle2} success />
        <KPI label="Watchlist"       value={stats.watchlistCount}             sub="dealers"      Icon={AlertTriangle} danger />
      </div>

      {/* chart + watchlist preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Outstanding by Company</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.chartData} barSize={18} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? '₹' + (v / 100000).toFixed(0) + 'L' : '₹' + (v / 1000).toFixed(0) + 'K'} />
              <Tooltip formatter={(v, name) => [fmtCurrency(v), name === 'outstanding' ? 'Outstanding' : 'Overdue']} />
              <Bar dataKey="outstanding" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="overdue"     fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Outstanding</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Overdue</div>
          </div>
        </div>

        {/* watchlist */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-600">Watchlist</h2>
            <Link to="/watchlist" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {dealers.filter(d => d.watchlist).slice(0, 6).map(d => {
              const rc = RISK[d.risk_level] || RISK.low
              return (
                <div key={d.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.town} · {d.overdue_count} overdue</p>
                  </div>
                  <span className={`badge ml-2 shrink-0 ${rc.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                    {rc.label}
                  </span>
                </div>
              )
            })}
            {dealers.filter(d => d.watchlist).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No watchlist entries</p>
            )}
          </div>
        </div>
      </div>

      {/* overdue table */}
      {stats.overdueInvs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600">Overdue Invoices</h2>
            <Link to="/invoices" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              All invoices <ArrowRight size={11} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Invoice', 'Stockist', 'Town', 'PSR', 'Balance', 'Due Date', 'Overdue By'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.overdueInvs.slice(0, 10).map(inv => {
                  const delay = Math.floor((new Date() - new Date(inv.due_date)) / 86400000)
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="td font-mono text-xs font-medium">{inv.invoice_number}</td>
                      <td className="td">
                        <span className="font-medium">{inv.stockist_name}</span>
                        {inv.watchlist && <span className="ml-1.5 badge-red badge">⚠ watchlist</span>}
                      </td>
                      <td className="td text-gray-500">{inv.town}</td>
                      <td className="td text-gray-500">{inv.psr_name}</td>
                      <td className="td text-right font-semibold text-red-600">{fmtCurrency(inv.balance)}</td>
                      <td className="td text-gray-500">{fmtDate(inv.due_date)}</td>
                      <td className="td">
                        <span className="badge-red badge">{delay}d late</span>
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
