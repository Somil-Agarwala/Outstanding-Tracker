import { useState, useMemo } from 'react'
import { useInvoices }   from '../../hooks/useInvoices'
import { useMasterData } from '../../hooks/useMasterData'
import { fmtCurrency, fmtDate, fmtDateShort, callStatus, CALL_STATUS, RISK } from '../../lib/utils'
import InvoiceModal from './InvoiceModal'
import { Plus, Search, Download, Phone, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'

const STATUS_FILTERS = [
  { value: '',          label: 'All Status'  },
  { value: 'overdue',   label: 'Overdue'     },
  { value: 'due_today', label: 'Due Today'   },
  { value: 'call_due',  label: 'Call Due'    },
  { value: 'partial',   label: 'Partial'     },
  { value: 'paid',      label: 'Paid'        },
  { value: 'upcoming',  label: 'Upcoming'    },
]

export default function InvoicesPage() {
  const [search,     setSearch]     = useState('')
  const [statusF,    setStatusF]    = useState('')
  const [companyF,   setCompanyF]   = useState('')
  const [psrF,       setPsrF]       = useState('')
  const [locationF,  setLocationF]  = useState('')
  const [showModal,  setShowModal]  = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  const { invoices, loading, saveInvoice } = useInvoices()
  const { companies, psrs, locations } = useMasterData()

  // sorted oldest → newest (ascending invoice_date)
  const sorted = useMemo(() =>
    [...invoices].sort((a, b) => {
      const da = a.invoice_date ? new Date(a.invoice_date) : 0
      const db = b.invoice_date ? new Date(b.invoice_date) : 0
      return da - db
    })
  , [invoices])

  const filtered = useMemo(() => {
    return sorted.filter(inv => {
      const cs = callStatus(inv)
      if (statusF   && cs !== statusF && inv.status !== statusF) return false
      if (companyF  && inv.company_id   !== companyF)  return false
      if (psrF      && inv.psr_id       !== psrF)       return false
      if (locationF && inv.location_name !== locationF) return false
      if (search) {
        const q = search.toLowerCase()
        if (!inv.invoice_number?.toLowerCase().includes(q) &&
            !inv.stockist_name?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [sorted, statusF, companyF, psrF, locationF, search])

  // unique location names from loaded invoices
  const locationNames = useMemo(() =>
    [...new Set(invoices.map(i => i.location_name).filter(Boolean))].sort()
  , [invoices])

  function openAdd()     { setEditTarget(null); setShowModal(true) }
  function openEdit(inv) { setEditTarget(inv);  setShowModal(true) }
  function closeModal()  { setShowModal(false); setEditTarget(null) }

  function clearFilters() {
    setSearch(''); setStatusF(''); setCompanyF('')
    setPsrF(''); setLocationF('')
  }

  function exportExcel() {
    const header = [
      'Invoice No','Invoice Date','Recd. Date','Company','Stockist','Town','PSR','Mobile',
      'Invoice Amount','CN / DN','Net Outstanding',
      'PDC Cheque','PDC Date','PDC Amount',
      'Credit Days','Due Date','Delay Days',
      'Paid Amount','Paid Date','Balance',
      'Status','Risk Level','Watchlist',
      'Remarks 1','Remarks 2',
    ]
    const rows = filtered.map(inv => [
      inv.invoice_number, inv.invoice_date, inv.payment_date ?? '',
      inv.company_name, inv.stockist_name, inv.town, inv.psr_name, inv.stockist_mobile,
      inv.invoice_amount, inv.cn_dn_amount, inv.net_outstanding,
      inv.pdc_cheque_number ?? '', inv.pdc_date ?? '', inv.pdc_amount,
      inv.credit_days, inv.due_date, inv.delay_days ?? 0,
      inv.payment_received, inv.payment_date ?? '', inv.balance,
      callStatus(inv), inv.risk_level, inv.watchlist ? 'Yes' : 'No',
      inv.calling_remarks_1 ?? '', inv.calling_remarks_2 ?? '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = header.map(() => ({ wch: 17 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Outstanding')
    XLSX.writeFile(wb, `Outstanding_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const hasFilters = search || statusF || companyF || psrF || locationF

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar ── */}
      <div className="shrink-0 px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-slate-800">Invoices</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">{filtered.length} records · oldest first</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="btn-secondary">
            <Download size={12} /> Export Excel
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={12} /> Add Invoice
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="shrink-0 px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="input pl-7 w-48"
            placeholder="Search invoice / stockist…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input w-32" value={statusF} onChange={e => setStatusF(e.target.value)}>
          {STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select className="input w-36" value={companyF} onChange={e => setCompanyF(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="input w-36" value={psrF} onChange={e => setPsrF(e.target.value)}>
          <option value="">All PSRs</option>
          {psrs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* LOCATION FILTER */}
        <select className="input w-36" value={locationF} onChange={e => setLocationF(e.target.value)}>
          <option value="">All Locations</option>
          {locationNames.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="text-[11px] text-indigo-600 hover:underline font-medium">
            Clear all
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full" style={{ minWidth: 1700 }}>
            <thead>
              <tr>
                {[
                  'Invoice No','Date','Recd. Date','Location','Company','Stockist','Town','PSR','Mobile',
                  'Inv Amt','CN/DN','Net Outstanding',
                  'PDC Cheque','PDC Date','PDC Amt',
                  'Credit','Due Date','Delay',
                  'Paid Amt','Paid Date','Balance',
                  'Status','Risk','Remarks 1','',
                ].map(h => <th key={h} className="th">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={25} className="td text-center text-slate-400 py-16">
                    No invoices found
                  </td>
                </tr>
              ) : filtered.map(inv => {
                const cs       = callStatus(inv)
                const sc       = CALL_STATUS[cs] ?? CALL_STATUS.upcoming
                const rc       = RISK[inv.risk_level] ?? RISK.low
                const isUrgent = cs === 'call_due' || cs === 'due_today'
                const delay    = inv.delay_days ?? 0

                return (
                  <tr
                    key={inv.id}
                    className={`transition-colors ${isUrgent ? 'bg-pink-50/40' : ''}`}
                  >
                    <td className="td font-mono text-[10px] font-bold text-indigo-700">{inv.invoice_number}</td>
                    <td className="td text-slate-400">{fmtDateShort(inv.invoice_date)}</td>
                    <td className="td text-slate-400">{fmtDateShort(inv.payment_date)}</td>
                    <td className="td text-slate-500">{inv.location_name}</td>
                    <td className="td text-slate-500">{inv.company_name}</td>
                    <td className="td">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-700 text-[11px]">{inv.stockist_name}</span>
                        {inv.watchlist && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="td text-slate-400">{inv.town}</td>
                    <td className="td text-slate-400">{inv.psr_name}</td>
                    <td className="td font-mono text-[10px] text-slate-300">{inv.stockist_mobile}</td>

                    <td className="td text-right font-semibold text-slate-700">{fmtCurrency(inv.invoice_amount)}</td>
                    <td className={`td text-right text-[10px] ${
                      Number(inv.cn_dn_amount) < 0 ? 'text-red-500 font-semibold'
                      : Number(inv.cn_dn_amount) > 0 ? 'text-emerald-600 font-semibold'
                      : 'text-slate-200'}`}>
                      {Number(inv.cn_dn_amount) !== 0 ? fmtCurrency(inv.cn_dn_amount) : '—'}
                    </td>
                    <td className="td text-right font-bold text-slate-800">{fmtCurrency(inv.net_outstanding)}</td>

                    <td className="td font-mono text-[10px] text-slate-400">{inv.pdc_cheque_number || '—'}</td>
                    <td className="td text-slate-400">{fmtDateShort(inv.pdc_date)}</td>
                    <td className="td text-right text-slate-500">
                      {Number(inv.pdc_amount) > 0 ? fmtCurrency(inv.pdc_amount) : '—'}
                    </td>

                    <td className="td text-center text-slate-400">{inv.credit_days}d</td>
                    <td className="td text-slate-500">{fmtDate(inv.due_date)}</td>
                    <td className="td text-center">
                      {delay > 0
                        ? <span className="badge badge-red">{delay}d</span>
                        : <span className="text-slate-200 text-[10px]">—</span>}
                    </td>

                    <td className="td text-right font-semibold text-emerald-600">
                      {Number(inv.payment_received) > 0 ? fmtCurrency(inv.payment_received) : '—'}
                    </td>
                    <td className="td text-slate-400">{fmtDateShort(inv.payment_date)}</td>
                    <td className={`td text-right font-bold ${Number(inv.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {fmtCurrency(inv.balance)}
                    </td>

                    <td className="td">
                      <span className={`badge ${sc.cls} ${isUrgent ? 'animate-callpulse' : ''}`}>
                        {isUrgent && <Phone size={9} />}
                        {sc.label}
                      </span>
                    </td>
                    <td className="td">
                      <span className={`badge ${rc.cls}`}>
                        <span className={`w-1 h-1 rounded-full ${rc.dot}`} />
                        {rc.label}
                      </span>
                    </td>
                    <td className="td max-w-[120px]">
                      <p className="text-[10px] text-slate-400 truncate">{inv.calling_remarks_1 || '—'}</p>
                    </td>
                    <td className="td">
                      <button
                        onClick={() => openEdit(inv)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium whitespace-nowrap"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <InvoiceModal
          invoice={editTarget}
          onSave={saveInvoice}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
