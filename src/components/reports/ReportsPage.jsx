import { useMemo, useState } from 'react'
import { useInvoices }  from '../../hooks/useInvoices'
import { useWatchlist } from '../../hooks/useWatchlist'
import { fmtCurrency, callStatus, RISK } from '../../lib/utils'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

export default function ReportsPage() {
  const { invoices } = useInvoices()
  const { dealers }  = useWatchlist()
  const [locationFilter, setLocationFilter] = useState('All')

  const analytics = useMemo(() => {
    // by company
    const byCompany = {}
    invoices.forEach(inv => {
      const k = inv.company_name ?? 'Unknown'
      if (!byCompany[k]) byCompany[k] = { name: k, outstanding: 0, overdue: 0, collected: 0, count: 0 }
      byCompany[k].outstanding += Number(inv.balance ?? 0)
      byCompany[k].collected   += Number(inv.payment_received ?? 0)
      byCompany[k].count++
      if (callStatus(inv) === 'overdue') byCompany[k].overdue += Number(inv.balance ?? 0)
    })

    // by PSR
    const byPsr = {}
    invoices.forEach(inv => {
      const k = inv.psr_name ?? 'Unknown'
      if (!byPsr[k]) byPsr[k] = { name: k, outstanding: 0, overdue: 0, count: 0 }
      byPsr[k].outstanding += Number(inv.balance ?? 0)
      byPsr[k].count++
      if (callStatus(inv) === 'overdue') byPsr[k].overdue += Number(inv.balance ?? 0)
    })
// by location + company
    const byLocationCompany = {}
    invoices.forEach(inv => {
      const loc = inv.location_name ?? 'Unknown'
      const com = inv.company_name  ?? 'Unknown'
      if (!byLocationCompany[loc]) byLocationCompany[loc] = {}
      if (!byLocationCompany[loc][com]) byLocationCompany[loc][com] = {
        company: com, outstanding: 0, overdue: 0, collected: 0, count: 0
      }
      byLocationCompany[loc][com].outstanding += Number(inv.balance ?? 0)
      byLocationCompany[loc][com].collected   += Number(inv.payment_received ?? 0)
      byLocationCompany[loc][com].count++
      if (callStatus(inv) === 'overdue')
        byLocationCompany[loc][com].overdue += Number(inv.balance ?? 0)
    })
    const locations = Object.keys(byLocationCompany).sort()
    // risk distribution pie
    const riskPie = [
      { name: 'Critical', value: dealers.filter(d => d.risk_level === 'critical').length, fill: '#ef4444' },
      { name: 'High',     value: dealers.filter(d => d.risk_level === 'high').length,     fill: '#f97316' },
      { name: 'Medium',   value: dealers.filter(d => d.risk_level === 'medium').length,   fill: '#f59e0b' },
      { name: 'Low',      value: dealers.filter(d => d.risk_level === 'low').length,       fill: '#10b981' },
    ].filter(d => d.value > 0)

    const companyArr = Object.values(byCompany).sort((a, b) => b.outstanding - a.outstanding)
    const psrArr     = Object.values(byPsr).sort((a, b) => b.outstanding - a.outstanding)

   return { companyArr, psrArr, riskPie, byLocationCompany, locations }
  }, [invoices, dealers])

  /* ── exports ── */
  function exportOutstanding() {
    const hdr = [
      'Invoice No','Invoice Date','Company','Stockist','Town','PSR','Mobile',
      'Invoice Amount','CN/DN','Net Outstanding','PDC Cheque','PDC Date','PDC Amount',
      'Credit Days','Due Date','Delay Days','Paid Amount','Paid Date','Balance',
      'Status','Risk Level','Watchlist','Remarks 1','Remarks 2',
    ]
    const rows = invoices.map(inv => {
      const delay = inv.delay_days ?? 0
      return [
        inv.invoice_number, inv.invoice_date, inv.company_name, inv.stockist_name,
        inv.town, inv.psr_name, inv.stockist_mobile,
        inv.invoice_amount, inv.cn_dn_amount, inv.net_outstanding,
        inv.pdc_cheque_number ?? '', inv.pdc_date ?? '', inv.pdc_amount,
        inv.credit_days, inv.due_date, delay,
        inv.payment_received, inv.payment_date ?? '', inv.balance,
        callStatus(inv), inv.risk_level, inv.watchlist ? 'Yes' : 'No',
        inv.calling_remarks_1 ?? '', inv.calling_remarks_2 ?? '',
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows])
    ws['!cols'] = hdr.map(() => ({ wch: 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Outstanding')
    XLSX.writeFile(wb, `Outstanding_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  function exportWatchlist() {
    const hdr = ['Dealer','Town','Company','PSR','Mobile','Risk Score','Risk Level',
      'Total Invoices','Times Overdue','Avg Delay (d)','Total Overdue Amount','Open Balance',
      'Last Payment','Watchlist Reason']
    const rows = dealers.filter(d => d.watchlist).map(d => [
      d.name, d.town, d.company_name, d.psr_name, d.mobile,
      d.risk_score, d.risk_level, d.total_invoices, d.overdue_count,
      Number(d.avg_delay_days ?? 0).toFixed(1), d.total_overdue_amount, d.total_balance,
      d.last_payment_date ?? '', d.watchlist_reason ?? '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows])
    ws['!cols'] = hdr.map(() => ({ wch: 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Watchlist')
    XLSX.writeFile(wb, `Watchlist_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  function exportFull() {
    const wb = XLSX.utils.book_new()

    // Sheet 1 — All invoices
    const inv_hdr = ['Invoice No','Date','Company','Stockist','Town','PSR',
      'Net Outstanding','Credit Days','Due Date','Delay Days','Paid','Balance','Status']
    const inv_rows = invoices.map(inv => [
      inv.invoice_number, inv.invoice_date, inv.company_name, inv.stockist_name,
      inv.town, inv.psr_name, inv.net_outstanding, inv.credit_days, inv.due_date,
      inv.delay_days ?? 0, inv.payment_received, inv.balance, callStatus(inv),
    ])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([inv_hdr, ...inv_rows]), 'All Invoices')

    // Sheet 2 — By company
    const comp_hdr = ['Company','Invoice Count','Outstanding','Overdue','Collected']
    const comp_rows = analytics.companyArr.map(c => [c.name, c.count, c.outstanding, c.overdue, c.collected])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([comp_hdr, ...comp_rows]), 'By Company')

    // Sheet 3 — By PSR
    const psr_hdr = ['PSR','Invoice Count','Outstanding','Overdue']
    const psr_rows = analytics.psrArr.map(p => [p.name, p.count, p.outstanding, p.overdue])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([psr_hdr, ...psr_rows]), 'By PSR')

    // Sheet 4 — Watchlist
    const wl_hdr = ['Dealer','Town','Risk Level','Risk Score','Times Overdue','Avg Delay','Overdue Amt']
    const wl_rows = dealers.filter(d => d.watchlist).map(d => [
      d.name, d.town, d.risk_level, d.risk_score, d.overdue_count,
      Number(d.avg_delay_days ?? 0).toFixed(0), d.total_overdue_amount,
    ])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([wl_hdr, ...wl_rows]), 'Watchlist')

    XLSX.writeFile(wb, `PayTrack_Full_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="p-6 space-y-6">

      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Analytics overview and Excel exports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportOutstanding} className="btn-secondary text-xs">
            <Download size={13} /> Outstanding
          </button>
          <button onClick={exportWatchlist} className="btn-secondary text-xs">
            <Download size={13} /> Watchlist
          </button>
          <button onClick={exportFull} className="btn-primary text-xs">
            <Download size={13} /> Full Report (4 sheets)
          </button>
        </div>
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* company bar chart */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Outstanding by Company</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={analytics.companyArr.slice(0, 8).map(d => ({
                ...d,
                name: d.name.length > 12 ? d.name.slice(0,12)+'…' : d.name,
              }))}
              layout="vertical" barSize={14}
            >
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 100000 ? '₹'+(v/100000).toFixed(0)+'L' : '₹'+(v/1000).toFixed(0)+'K'} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [fmtCurrency(v), n === 'outstanding' ? 'Outstanding' : 'Overdue']} />
              <Bar dataKey="outstanding" fill="#6366f1" radius={[0,4,4,0]} />
              <Bar dataKey="overdue"     fill="#f87171" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Outstanding</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Overdue</span>
          </div>
        </div>

        {/* risk pie chart */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Dealer Risk Distribution</h2>
          {analytics.riskPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={analytics.riskPie} cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                  {analytics.riskPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={9} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-gray-400 text-sm">
              No dealer data yet
            </div>
          )}
        </div>
      </div>

      {/* PSR performance table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-600">PSR Performance Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['PSR','Invoices','Outstanding Balance','Overdue Amount','Overdue %'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.psrArr.map(p => {
                const pct = p.outstanding > 0 ? Math.round((p.overdue / p.outstanding) * 100) : 0
                return (
                  <tr key={p.name} className="hover:bg-gray-50">
                    <td className="td font-medium">{p.name}</td>
                    <td className="td text-center text-gray-600">{p.count}</td>
                    <td className="td text-right font-semibold">{fmtCurrency(p.outstanding)}</td>
                    <td className={`td text-right font-medium ${p.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {fmtCurrency(p.overdue)}
                    </td>
                    <td className="td text-center">
                      <span className={`badge ${pct > 30 ? 'badge-red' : pct > 10 ? 'badge-amber' : 'badge-gray'}`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                )
              })}
              {analytics.psrArr.length === 0 && (
                <tr><td colSpan={5} className="td text-center text-gray-400 py-10">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
  {/* ── Company × Location table ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-gray-600">Company Performance by Location</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Location</span>
            <select
              className="input w-40 text-xs"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
            >
              <option value="All">All Locations</option>
              {analytics.locations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Location','Company','Invoices','Outstanding','Overdue','Collected','Overdue %'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.locations
                .filter(loc => locationFilter === 'All' || loc === locationFilter)
                .flatMap(loc =>
                  Object.values(analytics.byLocationCompany[loc])
                    .sort((a, b) => b.outstanding - a.outstanding)
                    .map((row, i) => {
                      const pct = row.outstanding > 0
                        ? Math.round((row.overdue / row.outstanding) * 100) : 0
                      return (
                        <tr key={`${loc}-${row.company}`} className="hover:bg-gray-50">
                          <td className="td text-xs font-medium text-indigo-600">
                            {i === 0 ? loc : ''}
                          </td>
                          <td className="td font-medium text-sm">{row.company}</td>
                          <td className="td text-center text-gray-600">{row.count}</td>
                          <td className="td text-right font-semibold">{fmtCurrency(row.outstanding)}</td>
                          <td className={`td text-right font-medium ${row.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {fmtCurrency(row.overdue)}
                          </td>
                          <td className="td text-right text-emerald-600 font-medium">
                            {fmtCurrency(row.collected)}
                          </td>
                          <td className="td text-center">
                            <span className={`badge ${pct > 30 ? 'badge-red' : pct > 10 ? 'badge-amber' : 'badge-gray'}`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      )
                    })
                )}
              {analytics.locations.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-10">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
