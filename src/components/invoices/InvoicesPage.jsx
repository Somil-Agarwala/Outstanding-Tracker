import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useInvoicesPage } from '../../hooks/useInvoicesPage'
import { useMasterData } from '../../hooks/useMasterData'
import { useAuth } from '../../hooks/useAuth'
import { fmtCurrency, fmtDateShort, riskOf, CALL_STATUS, cx } from '../../lib/utils'
import InvoiceModal from './InvoiceModal'
import * as XLSX from 'xlsx'
import {
  Plus, Search, X, Pencil, AlertTriangle, ChevronLeft, ChevronRight,
  Loader2, Download,
} from 'lucide-react'

const PAGE_SIZES = [50, 100, 250, 500]

/* Left offsets for the two pinned columns. Keep these in sync with
   the first two entries of COLS below. */
const STICK_1 = 0
const STICK_2 = 140

/* Every column, in display order. `w` drives the sticky offsets and
   the minimum table width, so widths live here and nowhere else. */
const COLS = [
  { key: 'invoice_number',       label: 'Invoice No',      w: 140, align: 'l', stick: 1 },
  { key: 'stockist_name',        label: 'Stockist',        w: 200, align: 'l', stick: 2 },
  { key: 'invoice_date',         label: 'Date',            w: 95,  align: 'l', type: 'date' },
  { key: 'payment_date',         label: 'Recd.Date',       w: 95,  align: 'l', type: 'date' },
  { key: 'invoice_received_date',label: 'Inv.Received',    w: 105, align: 'l', type: 'date' },
  { key: 'location_name',        label: 'Location',        w: 100, align: 'l' },
  { key: 'company_name',         label: 'Company',         w: 105, align: 'l' },
  { key: 'town',                 label: 'Town',            w: 120, align: 'l' },
  { key: 'psr_name',             label: 'PSR',             w: 135, align: 'l' },
  { key: 'stockist_mobile',      label: 'Mobile',          w: 115, align: 'l', mono: true },
  { key: 'invoice_amount',       label: 'Inv Amt',         w: 115, align: 'r', type: 'money' },
  { key: 'cn_dn_amount',         label: 'CN/DN',           w: 95,  align: 'r', type: 'money' },
  { key: 'net_outstanding',      label: 'Net Outstanding', w: 135, align: 'r', type: 'money' },
  { key: 'pdc_cheque_number',    label: 'PDC Cheque',      w: 110, align: 'l', mono: true },
  { key: 'pdc_date',             label: 'PDC Date',        w: 95,  align: 'l', type: 'date' },
  { key: 'pdc_amount',           label: 'PDC Amt',         w: 105, align: 'r', type: 'money' },
  { key: 'credit_days',          label: 'Credit',          w: 70,  align: 'c' },
  { key: 'due_date',             label: 'Due Date',        w: 95,  align: 'l', type: 'date' },
  { key: 'delay_days',           label: 'Delay',           w: 70,  align: 'c', type: 'delay' },
  { key: 'payment_received',     label: 'Paid Amt',        w: 115, align: 'r', type: 'money' },
  { key: 'payment_date_2',       label: 'Paid Date',       w: 95,  align: 'l', type: 'date', from: 'payment_date' },
  { key: 'balance',              label: 'Balance',         w: 125, align: 'r', type: 'balance' },
  { key: 'status',               label: 'Status',          w: 100, align: 'l', type: 'status' },
  { key: 'risk_level',           label: 'Risk',            w: 95,  align: 'l', type: 'risk' },
  { key: 'calling_remarks_1',    label: 'Remarks 1',       w: 150, align: 'l' },
  { key: '__edit',               label: 'Edit',            w: 60,  align: 'c', type: 'edit' },
]

const MIN_W = COLS.reduce((s, c) => s + c.w, 0)
const GRID  = COLS.map(c => `${c.w}px`).join(' ')

/* Wait a full second after the last keystroke before querying, so
   typing a dealer name is one request rather than one per letter. */
function useDebounced(value, ms = 1000) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function alignStyle(align) {
  if (align === 'r') return { justifyContent: 'flex-end', textAlign: 'right' }
  if (align === 'c') return { justifyContent: 'center', textAlign: 'center' }
  return {}
}

/* memo so changing one filter does not re-render every visible row */
const Row = memo(function Row({ inv, onEdit }) {
  const cs      = inv.call_status
  const meta    = CALL_STATUS[cs] ?? CALL_STATUS.upcoming
  const risk    = riskOf(inv.risk_level)
  const owed    = Math.max(0, Number(inv.balance ?? 0))
  const urgent  = cs === 'call_due' || cs === 'due_today'
  const rowBg   = inv.watchlist ? '#fff8f8' : urgent ? '#fff1f5' : '#ffffff'

  function cell(c) {
    const raw = c.from ? inv[c.from] : inv[c.key]
    switch (c.type) {
      case 'date':
        return <span className="text-gray-500">{fmtDateShort(raw)}</span>
      case 'money':
        return <span className="font-mono">{fmtCurrency(raw)}</span>
      case 'balance':
        return <span className="font-mono font-bold text-gray-800">{fmtCurrency(owed)}</span>
      case 'delay':
        return Number(raw) > 0
          ? <span className="badge badge-red">{raw}d</span>
          : <span className="text-gray-300">—</span>
      case 'status':
        return <span className={cx('badge', meta.cls)}>{meta.label}</span>
      case 'risk':
        return <span className={cx('badge', risk.cls)}>{risk.label}</span>
      case 'edit':
        return (
          <button onClick={() => onEdit(inv)} aria-label="Edit invoice"
            className="text-indigo-600 hover:text-indigo-800">
            <Pencil size={13} />
          </button>
        )
      default:
        if (c.key === 'invoice_number')
          return <span className="font-mono text-[11px] font-bold text-indigo-700">{raw}</span>
        if (c.key === 'stockist_name')
          return (
            <span className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-gray-800 text-xs truncate">{raw}</span>
              {inv.watchlist && <AlertTriangle size={10} className="text-red-500 shrink-0" />}
            </span>
          )
        if (c.mono)
          return <span className="font-mono text-[11px] text-gray-500">{raw ?? '—'}</span>
        return <span className="text-gray-500 truncate" title={raw ?? ''}>{raw ?? '—'}</span>
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: GRID, background: rowBg }}
      className="border-b border-gray-100 hover:brightness-[0.985]">
      {COLS.map(c => {
        const sticky = c.stick
          ? {
              position: 'sticky',
              left: c.stick === 1 ? STICK_1 : STICK_2,
              background: rowBg,
              zIndex: 2,
              boxShadow: c.stick === 2 ? '6px 0 8px -6px rgba(0,0,0,.12)' : undefined,
            }
          : {}
        return (
          <div key={c.key}
            style={{ padding: '7px 12px', whiteSpace: 'nowrap', display: 'flex',
                     alignItems: 'center', ...alignStyle(c.align), ...sticky }}>
            {cell(c)}
          </div>
        )
      })}
    </div>
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
  const [pageSize,  setPageSize]  = useState(50)
  const [page,      setPage]      = useState(1)
  const [modal,     setModal]     = useState(null)
  const [exporting, setExporting] = useState(false)

  const search = useDebounced(searchRaw, 1000)

  const filters = useMemo(
    () => ({ search, status, company, psr, location }),
    [search, status, company, psr, location])

  useEffect(() => { setPage(1) }, [search, status, company, psr, location, pageSize])

  const {
    rows, totalCount, outstanding, collected,
    loading, error, totalPages, saveInvoice, fetchAllForExport,
  } = useInvoicesPage(filters, page, pageSize)

  /* Prefetch the next page so paging forward feels instant. */
  useInvoicesPage(filters, Math.min(page + 1, totalPages), pageSize)

  const handleEdit = useCallback(inv => setModal(inv), [])

  const anyFilter = Boolean(search || status || company || psr || location)
  const clearFilters = () => {
    setSearchRaw(''); setStatus(''); setCompany(''); setPsr(''); setLocation('')
  }

  /* Exports every row matching the current filters, not just the page
     on screen. The only full read left in the app, and only on click. */
  async function exportExcel() {
    setExporting(true)
    try {
      const all = await fetchAllForExport()
      const header = [
        'Invoice No','Invoice Date','Recd. Date','Inv. Received Date',
        'Location','Company','Stockist','Town','PSR','Mobile',
        'Invoice Amount','CN / DN','Net Outstanding',
        'PDC Cheque','PDC Date','PDC Amount',
        'Credit Days','Due Date','Delay Days',
        'Paid Amount','Paid Date','Balance',
        'Status','Risk Level','Watchlist','Remarks 1','Remarks 2',
      ]
      const body = all.map(inv => [
        inv.invoice_number, inv.invoice_date, inv.payment_date ?? '',
        inv.invoice_received_date ?? '',
        inv.location_name, inv.company_name, inv.stockist_name,
        inv.town, inv.psr_name, inv.stockist_mobile,
        Number(inv.invoice_amount ?? 0), Number(inv.cn_dn_amount ?? 0),
        Number(inv.net_outstanding ?? 0),
        inv.pdc_cheque_number ?? '', inv.pdc_date ?? '', Number(inv.pdc_amount ?? 0),
        inv.credit_days, inv.due_date, inv.delay_days ?? 0,
        Number(inv.payment_received ?? 0), inv.payment_date ?? '',
        Math.max(0, Number(inv.balance ?? 0)),
        (CALL_STATUS[inv.call_status] ?? CALL_STATUS.upcoming).label,
        inv.risk_level, inv.watchlist ? 'Yes' : 'No',
        inv.calling_remarks_1 ?? '', inv.calling_remarks_2 ?? '',
      ])
      const ws = XLSX.utils.aoa_to_sheet([header, ...body])
      ws['!cols'] = header.map(() => ({ wch: 17 }))
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 }, e: { c: header.length - 1, r: body.length } }) }
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
      XLSX.writeFile(wb, `Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      alert('Export failed: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalCount)

  return (
    <div className="p-5 space-y-4">

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Invoices</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading
              ? 'Loading…'
              : `Showing ${from}–${to} of ${totalCount.toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={exporting || totalCount === 0}
            className="btn-primary disabled:opacity-50"
            title="Exports every row matching the current filters">
            {exporting
              ? <><Loader2 size={13} className="animate-spin" /> Exporting {totalCount.toLocaleString('en-IN')}…</>
              : <><Download size={13} /> Export Excel{anyFilter ? ` (${totalCount.toLocaleString('en-IN')})` : ''}</>}
          </button>
          <button onClick={() => setModal({})} className="btn-secondary">
            <Plus size={13} /> Add Invoice
          </button>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
            aria-label="Search invoices"
            placeholder="Search invoice or stockist…"
            className="input pl-8 w-56 text-xs py-1.5" />
          {searchRaw !== search && (
            <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 animate-spin" />
          )}
        </div>

        <select value={status} onChange={e => setStatus(e.target.value)}
          aria-label="Status" className="input w-auto text-xs py-1.5">
          <option value="">All Status</option>
          <option value="all_due">All Due</option>
          <option value="overdue">Overdue</option>
          <option value="due_today">Due Today</option>
          <option value="call_due">Call Due</option>
          <option value="partial">Partial</option>
          <option value="upcoming">Upcoming</option>
          <option value="paid">Paid</option>
        </select>

        <select value={company} onChange={e => setCompany(e.target.value)}
          aria-label="Company" className="input w-auto text-xs py-1.5">
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={psr} onChange={e => setPsr(e.target.value)}
          aria-label="PSR" className="input w-auto text-xs py-1.5">
          <option value="">All PSRs</option>
          {allPsrs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {isAdmin && (
          <select value={location} onChange={e => setLocation(e.target.value)}
            aria-label="Location" className="input w-auto text-xs py-1.5">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}

        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
          aria-label="Rows per page" className="input w-auto text-xs py-1.5">
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>

        {anyFilter && (
          <button onClick={clearFilters} className="btn-secondary text-xs py-1.5">
            <X size={12} /> Clear
          </button>
        )}

        <div className="ml-auto flex gap-5 text-xs">
          <span className="text-gray-400">
            Outstanding <b className="text-gray-800 font-mono text-[13px]">{fmtCurrency(outstanding)}</b>
          </span>
          <span className="text-gray-400">
            Collected <b className="text-emerald-600 font-mono text-[13px]">{fmtCurrency(collected)}</b>
          </span>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200">
          <p className="text-sm text-red-700 font-semibold">Could not load invoices</p>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-290px)] relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 z-20 flex items-start justify-center pt-20">
              <Loader2 size={20} className="animate-spin text-indigo-500" />
            </div>
          )}

          <div style={{ minWidth: MIN_W }}>
            {/* header */}
            <div style={{ display: 'grid', gridTemplateColumns: GRID }}
              className="bg-slate-50 border-b border-gray-200 sticky top-0 z-30">
              {COLS.map(c => {
                const sticky = c.stick
                  ? { position: 'sticky', left: c.stick === 1 ? STICK_1 : STICK_2,
                      background: '#f8fafc', zIndex: 40,
                      boxShadow: c.stick === 2 ? '6px 0 8px -6px rgba(0,0,0,.12)' : undefined }
                  : {}
                return (
                  <div key={c.key}
                    style={{ padding: '8px 12px', whiteSpace: 'nowrap', display: 'flex',
                             alignItems: 'center', ...alignStyle(c.align), ...sticky }}
                    className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {c.label}
                  </div>
                )
              })}
            </div>

            {rows.map(inv => <Row key={inv.id} inv={inv} onEdit={handleEdit} />)}

            {!loading && rows.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400">
                {anyFilter ? 'No invoices match these filters' : 'No invoices yet'}
              </div>
            )}
          </div>
        </div>

        {/* ── Pagination ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">
            Invoice No and Stockist stay pinned while scrolling · {COLS.length} columns
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 mr-1">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(1)} disabled={page <= 1}
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40">First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              aria-label="Previous page"
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"><ChevronLeft size={13} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              aria-label="Next page"
              className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"><ChevronRight size={13} /></button>
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
