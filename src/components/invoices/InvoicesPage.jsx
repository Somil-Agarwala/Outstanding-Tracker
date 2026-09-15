import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useInvoicesPage } from '../../hooks/useInvoicesPage'
import { useMasterData } from '../../hooks/useMasterData'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { fmtCurrency, fmtDateShort, riskOf, CALL_STATUS, cx } from '../../lib/utils'
import InvoiceModal from './InvoiceModal'
import {
  Plus, Search, X, Pencil, AlertTriangle, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react'

const PAGE_SIZES = [50, 100, 250, 500]

/* Debounce — without this the table re-queries on every keystroke.
   Typing "vinayak" fired 7 requests; now it fires one.
   Waits 1s after the last keystroke before querying. */
function useDebounced(value, ms = 1000) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/* memo so changing one filter does not re-render 500 rows */
const Row = memo(function Row({ inv, onEdit }) {
  const cs   = inv.call_status
  const meta = CALL_STATUS[cs] ?? CALL_STATUS.upcoming
  const risk = riskOf(inv.risk_level)
  const owed = Math.max(0, Number(inv.balance ?? 0))
  const urgent = cs === 'call_due' || cs === 'due_today'

  const rowType = inv.watchlist ? 'watchlist' : urgent ? 'urgent' : undefined
  const stickyBg = inv.watchlist ? '#fff8f8' : urgent ? '#fff1f5' : '#ffffff'

  return (
    <tr data-row={rowType} className="hover:bg-[#f0f7ff]">
      <td className="td font-mono text-[10px] font-bold text-indigo-700 sticky z-[2]"
          style={{ left: 0, background: stickyBg }}>
        {inv.invoice_number}
      </td>
      <td className="td sticky z-[2]" style={{ left: 115, background: stickyBg }}>
        <div className="flex items-center gap-1">
          <span className="font-semibold text-slate-700 text-xs truncate max-w-[130px]">
            {inv.stockist_name}
          </span>
          {inv.watchlist && <AlertTriangle size={10} className="text-red-500 shrink-0" />}
        </div>
      </td>
      <td className="td text-slate-400">{fmtDateShort(inv.invoice_date)}</td>
      <td className="td text-slate-400">{fmtDateShort(inv.invoice_received_date)}</td>
      <td className="td text-slate-400">{inv.location_name}</td>
      <td className="td text-slate-400">{inv.company_name}</td>
      <td className="td text-slate-400">{inv.town}</td>
      <td className="td text-slate-400">{inv.psr_name ?? '—'}</td>
      <td className="td font-mono text-[10px] text-slate-400">{inv.stockist_mobile ?? '—'}</td>
      <td className="td text-right font-mono">{fmtCurrency(inv.invoice_amount)}</td>
      <td className="td text-right font-mono text-slate-400">{fmtCurrency(inv.cn_dn_amount)}</td>
      <td className="td text-right font-mono font-semibold">{fmtCurrency(inv.net_outstanding)}</td>
      <td className="td font-mono text-[10px] text-slate-400">{inv.pdc_cheque_number ?? '—'}</td>
      <td className="td text-slate-400">{fmtDateShort(inv.pdc_date)}</td>
      <td className="td text-right font-mono text-slate-400">{fmtCurrency(inv.pdc_amount)}</td>
      <td className="td text-center text-slate-400">{inv.credit_days}d</td>
      <td className="td text-slate-400">{fmtDateShort(inv.due_date)}</td>
      <td className="td text-center">
        {inv.delay_days > 0
          ? <span className="badge badge-red">{inv.delay_days}d</span>
          : <span className="text-slate-300">—</span>}
      </td>
      <td className="td text-right font-mono text-emerald-600">{fmtCurrency(inv.payment_received)}</td>
      <td className="td text-slate-400">{fmtDateShort(inv.payment_date)}</td>
      <td className="td text-right font-mono font-bold">
        <span className={owed > 0 ? 'text-slate-800' : 'text-slate-300'}>{fmtCurrency(owed)}</span>
      </td>
      <td className="td"><span className={cx('badge', meta.cls)}>{meta.label}</span></td>
      <td className="td"><span className={cx('badge', risk.cls)}>{risk.label}</span></td>
      <td className="td text-slate-400 max-w-[150px] truncate" title={inv.calling_remarks_1 ?? ''}>
        {inv.calling_remarks_1 ?? '—'}
      </td>
      <td className="td">
        <button onClick={() => onEdit(inv)} className="text-indigo-600 hover:text-indigo-800">
          <Pencil size={13} />
        </button>
      </td>
    </tr>
  )
})

export default function InvoicesPage() {
  const { profile, isAdmin } = useAuth()
  const { companies, locations, allPsrs, allStockists } = useMasterData()

  const [searchRaw, setSearchRaw] = useState('')
  const [status,    setStatus]    = useState('')
  const [company,   setCompany]   = useState('')
  const [psr,       setPsr]       = useState('')
  const [location,  setLocation]  = useState('')
  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(50)
  const [modal,     setModal]     = useState(null)

  const search = useDebounced(searchRaw, 1000)

  const filters = useMemo(
    () => ({ search, status, company, psr, location }),
    [search, status, company, psr, location])

  // any filter change resets to page 1
  useEffect(() => { setPage(1) }, [search, status, company, psr, location, pageSize])

  const {
    rows, totalCount, outstanding, collected,
    loading, error, totalPages, saveInvoice,
  } = useInvoicesPage(filters, page, pageSize)

  /* Prefetch the next page so paging forward feels instant.
     The result lands in the shared cache; no extra render. */
  useInvoicesPage(filters, Math.min(page + 1, totalPages), pageSize)

  const handleEdit = useCallback(inv => setModal(inv), [])

  const clearFilters = () => {
    setSearchRaw(''); setStatus(''); setCompany(''); setPsr(''); setLocation('')
  }
  const anyFilter = search || status || company || psr || location

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalCount)

  return (
    <div className="p-5 space-y-4">

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Invoices</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? 'Loading…' : `Showing ${from}–${to} of ${totalCount.toLocaleString('en-IN')}`}
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={13} /> Add Invoice
        </button>
      </div>

      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
            placeholder="Invoice no or stockist…"
            className="input pl-8 w-56 text-xs py-1.5" />
          {searchRaw !== search && (
            <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 animate-spin" />
          )}
        </div>

        <select value={status} onChange={e => setStatus(e.target.value)} className="input w-auto text-xs py-1.5">
          <option value="">All Status</option>
          <option value="all_due">All Due</option>
          <option value="overdue">Overdue</option>
          <option value="due_today">Due Today</option>
          <option value="call_due">Call Due</option>
          <option value="partial">Partial</option>
          <option value="upcoming">Upcoming</option>
          <option value="paid">Paid</option>
        </select>

        <select value={company} onChange={e => setCompany(e.target.value)} className="input w-auto text-xs py-1.5">
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={psr} onChange={e => setPsr(e.target.value)} className="input w-auto text-xs py-1.5">
          <option value="">All PSRs</option>
          {allPsrs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {isAdmin && (
          <select value={location} onChange={e => setLocation(e.target.value)} className="input w-auto text-xs py-1.5">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}

        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
          className="input w-auto text-xs py-1.5" title="Rows per page">
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>

        {anyFilter && (
          <button onClick={clearFilters} className="btn-secondary text-xs py-1.5">
            <X size={12} /> Clear
          </button>
        )}

        <div className="ml-auto flex gap-4 text-xs">
          <span className="text-slate-400">
            Outstanding <b className="text-slate-800 font-mono">{fmtCurrency(outstanding)}</b>
          </span>
          <span className="text-slate-400">
            Collected <b className="text-emerald-600 font-mono">{fmtCurrency(collected)}</b>
          </span>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200">
          <p className="text-sm text-red-700 font-semibold">Could not load invoices</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-290px)] relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 z-20 flex items-start justify-center pt-20">
              <Loader2 size={20} className="animate-spin text-indigo-500" />
            </div>
          )}
          <table className="w-full">
            <thead>
              <tr>
                <th className="th sticky z-[4]" style={{ left: 0, top: 0, background: '#f8fafc' }}>Invoice No</th>
                <th className="th sticky z-[4]" style={{ left: 115, top: 0, background: '#f8fafc' }}>Stockist</th>
                {['Date','Recd.Date','Location','Company','Town','PSR','Mobile','Inv Amt','CN/DN',
                  'Net Outstanding','PDC Cheque','PDC Date','PDC Amt','Credit','Due Date','Delay',
                  'Paid Amt','Paid Date','Balance','Status','Risk','Remarks 1',''].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(inv => <Row key={inv.id} inv={inv} onEdit={handleEdit} />)}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={25} className="td text-center text-slate-400 py-10">
                    {anyFilter ? 'No invoices match these filters' : 'No invoices yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page <= 1}
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40">First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40">
              <ChevronLeft size={13} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40">
              <ChevronRight size={13} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40">Last</button>
          </div>
        </div>
      </div>

      {modal !== null && (
        <InvoiceModal
          invoice={modal?.id ? modal : null}
          companies={companies}
          stockists={allStockists}
          locations={locations}
          onSave={(payload, id) => saveInvoice(payload, id, profile?.id)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
