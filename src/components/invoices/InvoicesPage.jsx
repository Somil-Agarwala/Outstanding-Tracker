import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useInvoicesPage } from '../../hooks/useInvoicesPage'
import { useMasterData } from '../../hooks/useMasterData'
import { useAuth } from '../../hooks/useAuth'
import { fmtCurrency, fmtDateShort, CALL_STATUS } from '../../lib/utils'
import InvoiceModal from './InvoiceModal'
import * as XLSX from 'xlsx'
import { Plus, Search, X, Pencil, AlertTriangle, Loader2, Download, Check } from 'lucide-react'
import { Card, RiskBadge, StatusBadge, ErrorState, NoResults, EmptyState, LoadingRows, Pager } from '../ui'

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

const ROW_BG = { overdue: '#fdf6f4', due_today: '#fffdf5', call_due: '#fffdf5', partial: '#fffdf5' }

/* memo so changing one filter does not re-render every visible row */
const Row = memo(function Row({ inv, onEdit }) {
  const cs    = inv.call_status
  const owed  = Math.max(0, Number(inv.balance ?? 0))
  const rowBg = ROW_BG[cs] ?? '#ffffff'

  function cell(c) {
    const raw = c.from ? inv[c.from] : inv[c.key]
    switch (c.type) {
      case 'date':
        return <span className="text-xs text-muted">{fmtDateShort(raw)}</span>
      case 'money':
        return <span className={`font-mono text-xs ${Number(raw) ? 'text-ink' : 'text-dim'}`}>{fmtCurrency(raw)}</span>
      case 'balance':
        return <span className="font-mono text-[13px] font-semibold text-ink">{fmtCurrency(owed)}</span>
      case 'delay':
        return Number(raw) > 0
          ? <span className="text-xs font-semibold text-bad">{raw}d</span>
          : <span className="text-xs text-dim">—</span>
      case 'status':
        return <StatusBadge status={cs} />
      case 'risk':
        return <RiskBadge level={inv.risk_level} />
      case 'edit':
        return (
          <button type="button" onClick={() => onEdit(inv)} aria-label={`Edit invoice ${inv.invoice_number}`}
            className="text-brand hover:text-brand-dark p-1">
            <Pencil size={14} />
          </button>
        )
      default:
        if (c.key === 'invoice_number')
          return <span className="font-mono text-[11.5px] font-semibold text-brand">{raw}</span>
        if (c.key === 'stockist_name')
          return (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-ink text-[12.5px] truncate" title={raw}>{raw}</span>
              {inv.watchlist && <AlertTriangle size={11} className="text-bad shrink-0" aria-label="On watchlist" />}
            </span>
          )
        if (c.mono)
          return <span className="font-mono text-[11.5px] text-muted">{raw || '—'}</span>
        if (c.key === 'calling_remarks_1')
          return <span className="text-[11.5px] text-faint truncate" title={raw ?? ''}>{raw || '—'}</span>
        return <span className="text-xs text-muted truncate" title={raw ?? ''}>{raw ?? '—'}</span>
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: GRID, background: rowBg }}
      className="border-b border-line-soft hover:brightness-[0.985]">
      {COLS.map(c => {
        const sticky = c.stick
          ? {
              position: 'sticky',
              left: c.stick === 1 ? STICK_1 : STICK_2,
              background: rowBg,
              zIndex: 2,
              boxShadow: c.stick === 2 ? '6px 0 8px -6px rgba(21,23,26,0.12)' : undefined,
            }
          : {}
        return (
          <div key={c.key}
            style={{ padding: '11px 12px', whiteSpace: 'nowrap', display: 'flex', minWidth: 0,
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
  const [toast,     setToast]     = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const search = useDebounced(searchRaw, 1000)

  const filters = useMemo(
    () => ({ search, status, company, psr, location }),
    [search, status, company, psr, location])

  useEffect(() => { setPage(1) }, [search, status, company, psr, location, pageSize])

  const {
    rows, totalCount, outstanding, collected,
    loading, error, totalPages, saveInvoice, fetchAllForExport, refetch,
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

  const sel = on => `input w-auto px-2.5 text-[12.5px] ${on ? 'border-brand' : ''}`

  return (
    <div className="page gap-3.5">

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-sub">
            {loading && !rows.length
              ? 'Loading…'
              : `Showing ${from}–${to} of ${totalCount.toLocaleString('en-IN')} ${anyFilter ? 'matching ' : ''}invoices`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={exportExcel} disabled={exporting || totalCount === 0}
            className="btn-primary" title="Exports every row matching the current filters, not just this page">
            {exporting
              ? <><Loader2 size={15} className="animate-spin" /> Exporting {totalCount.toLocaleString('en-IN')}…</>
              : <><Download size={15} aria-hidden="true" /> Export Excel ({totalCount.toLocaleString('en-IN')})</>}
          </button>
          <button type="button" onClick={() => setModal({})} className="btn-secondary min-h-[42px]">
            <Plus size={14} aria-hidden="true" /> Add Invoice
          </button>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <Card className="px-4 py-3.5 flex flex-wrap gap-2.5 items-center">
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
            aria-label="Search invoices" type="search"
            placeholder="Search invoice or stockist…"
            className="input pl-8 text-[12.5px] sm:w-[225px]" />
          {searchRaw !== search && (
            <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint animate-spin" />
          )}
        </div>

        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status" className={sel(status)}>
          <option value="">All Status</option>
          <option value="all_due">All Due</option>
          <option value="overdue">Overdue</option>
          <option value="due_today">Due Today</option>
          <option value="call_due">Call Due</option>
          <option value="partial">Partial</option>
          <option value="upcoming">Upcoming</option>
          <option value="paid">Paid</option>
        </select>

        <select value={company} onChange={e => setCompany(e.target.value)} aria-label="Company" className={sel(company)}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={psr} onChange={e => setPsr(e.target.value)} aria-label="PSR" className={sel(psr)}>
          <option value="">All PSRs</option>
          {allPsrs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {isAdmin && (
          <select value={location} onChange={e => setLocation(e.target.value)} aria-label="Location" className={sel(location)}>
            <option value="">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}

        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
          aria-label="Rows per page" className={sel(false)}>
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>

        {anyFilter && (
          <button type="button" onClick={clearFilters} className="btn-secondary px-3.5 text-[12.5px]">
            <X size={13} aria-hidden="true" /> Clear
          </button>
        )}

        <div className="w-full xl:w-auto xl:ml-auto flex gap-5 items-baseline">
          <span className="text-[12.5px] text-muted">
            Outstanding <b className="font-mono text-bad text-[14.5px]">{fmtCurrency(outstanding)}</b>
          </span>
          <span className="text-[12.5px] text-muted">
            Collected <b className="font-mono text-good text-[14.5px]">{fmtCurrency(collected)}</b>
          </span>
        </div>
      </Card>

      {/* ── Table ─────────────────────────────────────────── */}
      <Card className="overflow-hidden flex flex-col">
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
        <div className="overflow-auto max-h-[calc(100vh-300px)] min-h-[320px] relative">
          {loading && rows.length > 0 && (
            <div className="absolute inset-0 bg-white/60 z-50 flex items-start justify-center pt-20">
              <Loader2 size={20} className="animate-spin text-brand" />
            </div>
          )}

          <div style={{ minWidth: MIN_W }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID }}
              className="bg-surface border-b border-line sticky top-0 z-30">
              {COLS.map(c => {
                const sticky = c.stick
                  ? { position: 'sticky', left: c.stick === 1 ? STICK_1 : STICK_2,
                      background: '#faf9f5', zIndex: 40,
                      boxShadow: c.stick === 2 ? '6px 0 8px -6px rgba(21,23,26,0.12)' : undefined }
                  : {}
                return (
                  <div key={c.key}
                    style={{ padding: '11px 12px', whiteSpace: 'nowrap', display: 'flex',
                             alignItems: 'center', ...alignStyle(c.align), ...sticky }}
                    className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-faint">
                    {c.label}
                  </div>
                )
              })}
            </div>

            {rows.map(inv => <Row key={inv.id} inv={inv} onEdit={handleEdit} />)}
          </div>

          {loading && rows.length === 0 && (
            <div className="px-6 sticky left-0 max-w-[900px]"><LoadingRows /></div>
          )}
          {!loading && rows.length === 0 && (
            <div className="sticky left-0 max-w-[900px] mx-auto">
              {anyFilter
                ? <NoResults query={search} what="invoice" onClear={clearFilters} />
                : <EmptyState title="No invoices yet" body="Add your first invoice to start tracking what is owed." />}
            </div>
          )}
        </div>
        )}

        {/* ── Pagination ──────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-[13px] border-t border-line">
          <p className="text-xs text-faint">
            Invoice No and Stockist stay pinned while scrolling · {COLS.length} columns
          </p>
          <Pager page={page} totalPages={totalPages} setPage={setPage} />
        </div>
      </Card>

      {toast && (
        <div role="status" className="fixed z-50 left-1/2 -translate-x-1/2 bottom-[88px] md:bottom-6 flex items-center gap-2.5 px-4 py-3.5 bg-good-bg border border-good-line rounded-[10px] shadow-lg">
          <Check size={17} strokeWidth={2.4} className="text-good" aria-hidden="true" />
          <span className="text-[13px] text-good-ink">{toast}</span>
        </div>
      )}

      {modal !== null && (
        <InvoiceModal
          invoice={modal?.id ? modal : null}
          companies={companies}
          stockists={allStockists}
          locations={locations}
          onSave={async (payload, id) => {
            await saveInvoice(payload, id, profile?.id)
            setToast(`Invoice ${payload.invoice_number} ${id ? 'updated' : 'saved'}`)
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
