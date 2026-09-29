import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  Plus, Search, X, Pencil, AlertTriangle, Download, Check, ChevronUp, ChevronDown, Rows3, Columns3,
} from 'lucide-react'
import { useLedger } from '../../hooks/useLedger'
import { useMasterData } from '../../hooks/useMasterData'
import { useAuth } from '../../hooks/useAuth'
import { fmtCurrency, fmtDate, fmtDateShort } from '../../lib/utils'
import { dayNum, todayNum } from '../../lib/ledger'
import { saveInvoice } from '../../lib/invoiceWrites'
import InvoiceModal from './InvoiceModal'
import {
  Card, RiskBadge, StatusBadge, statusMeta, ErrorState, NoResults, EmptyState, LoadingRows, Pager, TONE,
} from '../ui'

const PAGE_SIZES = [50, 100, 250, 500]
const STATUS_ORDER = { overdue: 0, due_today: 1, call_due: 2, partial: 3, upcoming: 4, paid: 5 }
const STRIPE = { overdue: '#a6321f', due_today: '#8f5a0c', call_due: '#8f5a0c', partial: '#c98a1f', upcoming: '#e3e1db', paid: '#2d6a4a' }
const ROW_BG = { overdue: '#fdf6f4', due_today: '#fffdf5', call_due: '#fffdf5' }

const TABS = [
  { key: 'all_due',   label: 'Unpaid',       test: r => r.owed > 0,                     tone: 'brand' },
  { key: 'overdue',   label: 'Overdue',      test: r => r.call_status === 'overdue',     tone: 'bad' },
  { key: 'due_today', label: 'Due Today',    test: r => r.call_status === 'due_today',   tone: 'warn' },
  { key: 'call_due',  label: 'Due Tomorrow', test: r => r.call_status === 'call_due',    tone: 'warn' },
  { key: 'partial',   label: 'Part Paid',    test: r => Number(r.payment_received) > 0 && r.owed > 0, tone: 'warn' },
  { key: 'upcoming',  label: 'Upcoming',     test: r => r.call_status === 'upcoming',    tone: 'neutral' },
  { key: 'paid',      label: 'Paid',         test: r => r.call_status === 'paid',        tone: 'good', noAmount: true },
  { key: 'all',       label: 'All',          test: () => true,                           tone: 'neutral' },
]

function statusOf(r, today) {
  if (r.owed <= 0) return 'paid'
  if (r.late > 0) return 'overdue'
  if (r.isDueToday) return 'due_today'
  if (r.dueNum === today + 1) return 'call_due'
  if (Number(r.payment_received) > 0) return 'partial'
  return 'upcoming'
}

const SORTS = {
  priority: (a, b) => STATUS_ORDER[a.call_status] - STATUS_ORDER[b.call_status] || b.late - a.late || b.owed - a.owed,
  invoice:  (a, b) => (dayNum(a.invoice_date) ?? 0) - (dayNum(b.invoice_date) ?? 0),
  stockist: (a, b) => String(a.stockist_name).localeCompare(String(b.stockist_name)),
  company:  (a, b) => String(a.company_name).localeCompare(String(b.company_name)),
  due:      (a, b) => (a.dueNum ?? 0) - (b.dueNum ?? 0),
  net:      (a, b) => Number(a.net_outstanding) - Number(b.net_outstanding),
  paid:     (a, b) => Number(a.payment_received) - Number(b.payment_received),
  balance:  (a, b) => a.owed - b.owed,
  status:   (a, b) => STATUS_ORDER[a.call_status] - STATUS_ORDER[b.call_status] || b.late - a.late,
}

function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/* ── Compact view: every fact that matters, no sideways scrolling ── */

function dueNote(r, today) {
  if (r.call_status === 'overdue')   return { text: `${r.late} day${r.late === 1 ? '' : 's'} late`, cls: 'text-bad font-semibold' }
  if (r.call_status === 'due_today') return { text: 'due today', cls: 'text-warn font-semibold' }
  if (r.call_status === 'call_due')  return { text: 'due tomorrow', cls: 'text-warn font-semibold' }
  if (r.owed > 0 && r.dueNum != null) return { text: `in ${r.dueNum - today} days`, cls: 'text-faint' }
  const paid = dayNum(r.payment_date)
  if (r.owed <= 0 && paid != null && r.dueNum != null) {
    const d = paid - r.dueNum
    return d <= 0 ? { text: 'paid on time', cls: 'text-good' } : { text: `paid ${d}d late`, cls: d > 15 ? 'text-bad' : 'text-warn' }
  }
  return { text: '', cls: '' }
}

const CompactRow = memo(function CompactRow({ r, today, onEdit }) {
  const note = dueNote(r, today)
  const paid = Number(r.payment_received) || 0
  const bg = ROW_BG[r.call_status]
  return (
    <tr className="border-b border-line-soft hover:!bg-surface" style={bg ? { background: bg } : undefined}>
      <td className="py-2.5 pl-3 pr-3 border-l-4" style={{ borderLeftColor: STRIPE[r.call_status] }}>
        <div className="font-mono text-[12.5px] font-semibold text-brand">{r.invoice_number}</div>
        <div className="text-[11.5px] text-faint mt-0.5">{fmtDate(r.invoice_date)}</div>
      </td>
      <td className="py-2.5 pr-3 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link to={`/dealers/${r.stockist_id}`} className="text-[13px] font-semibold text-ink hover:text-brand truncate" title={r.stockist_name}>
            {r.stockist_name}
          </Link>
          {r.watchlist && <AlertTriangle size={12} className="text-bad shrink-0" aria-label="On watchlist" />}
        </div>
        <div className="text-[11.5px] text-faint mt-0.5 truncate">{[r.town, r.psr_name].filter(Boolean).join(' · ')}</div>
      </td>
      <td className="py-2.5 pr-3 text-[12.5px] text-muted truncate">{r.company_name}</td>
      <td className="py-2.5 pr-3">
        <div className="text-[12.5px] text-ink">{fmtDate(r.due_date)}</div>
        {note.text && <div className={`text-[11.5px] mt-0.5 ${note.cls}`}>{note.text}</div>}
      </td>
      <td className="py-2.5 pr-3 text-right font-mono text-[12.5px] text-ink">{fmtCurrency(r.net_outstanding)}</td>
      <td className="py-2.5 pr-3 text-right">
        <div className={`font-mono text-[12.5px] ${paid ? 'text-good' : 'text-dim'}`}>{fmtCurrency(paid)}</div>
        {paid > 0 && (
          r.payment_date
            ? <div className="text-[11.5px] text-faint mt-0.5">{fmtDateShort(r.payment_date)}</div>
            : <div className="text-[11.5px] text-warn font-semibold mt-0.5">no date</div>
        )}
      </td>
      <td className={`py-2.5 pr-4 text-right font-mono text-[14px] font-semibold ${r.owed ? (r.call_status === 'overdue' ? 'text-bad' : 'text-ink') : 'text-dim'}`}>
        {r.owed ? fmtCurrency(r.owed) : '—'}
      </td>
      <td className="py-2.5 pr-3"><StatusBadge status={r.call_status} /></td>
      <td className="py-2.5 pr-3"><RiskBadge level={r.risk_level} /></td>
      <td className="py-2.5 pr-3 min-w-0">
        <div className="text-[12px] text-muted truncate" title={r.calling_remarks_1 ?? ''}>{r.calling_remarks_1 || <span className="text-dim">—</span>}</div>
        {r.calling_remarks_2 && <div className="text-[11.5px] text-faint truncate mt-0.5" title={r.calling_remarks_2}>{r.calling_remarks_2}</div>}
      </td>
      <td className="py-2.5 pr-3 text-center">
        <button type="button" onClick={() => onEdit(r)} aria-label={`Edit invoice ${r.invoice_number}`}
          className="text-brand hover:text-brand-dark p-1.5 rounded hover:bg-indigo-50"><Pencil size={14} /></button>
      </td>
    </tr>
  )
})

const InvoiceCard = memo(function InvoiceCard({ r, today, onEdit }) {
  const note = dueNote(r, today)
  return (
    <div className="bg-white border border-line rounded-xl p-3.5 border-l-4" style={{ borderLeftColor: STRIPE[r.call_status] }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/dealers/${r.stockist_id}`} className="block text-[14px] font-bold text-ink truncate">{r.stockist_name}</Link>
          <div className="text-[11.5px] text-faint mt-0.5 truncate">
            <span className="font-mono font-semibold text-brand">{r.invoice_number}</span> · {r.company_name} · {fmtDate(r.invoice_date)}
          </div>
        </div>
        <StatusBadge status={r.call_status} />
      </div>
      <div className="flex items-end justify-between gap-2 mt-2.5">
        <div>
          <div className={`font-mono text-[19px] font-semibold ${r.owed ? (r.call_status === 'overdue' ? 'text-bad' : 'text-ink') : 'text-good'}`}>
            {r.owed ? fmtCurrency(r.owed) : 'Paid'}
          </div>
          <div className="text-[12px] mt-0.5">
            <span className="text-muted">Due {fmtDate(r.due_date)}</span>
            {note.text && <span className={note.cls}> · {note.text}</span>}
          </div>
        </div>
        <button type="button" onClick={() => onEdit(r)} aria-label={`Edit invoice ${r.invoice_number}`}
          className="w-11 h-11 flex items-center justify-center rounded-lg border border-line-input text-brand shrink-0"><Pencil size={15} /></button>
      </div>
      {r.calling_remarks_1 && <div className="text-[12px] text-muted mt-2 truncate">{r.calling_remarks_1}</div>}
    </div>
  )
})

const COMPACT_COLS = [
  { key: 'invoice',  label: 'Invoice',    w: '11%',  sort: 'invoice' },
  { key: 'stockist', label: 'Stockist',   w: '17%',  sort: 'stockist' },
  { key: 'company',  label: 'Company',    w: '8%',   sort: 'company' },
  { key: 'due',      label: 'Due',        w: '10%',  sort: 'due' },
  { key: 'net',      label: 'Net Amount', w: '9%',   sort: 'net', right: true },
  { key: 'paid',     label: 'Received',   w: '9%',   sort: 'paid', right: true },
  { key: 'balance',  label: 'Balance',    w: '10%',  sort: 'balance', right: true },
  { key: 'status',   label: 'Status',     w: '8%',   sort: 'status' },
  { key: 'risk',     label: 'Risk',       w: '7%' },
  { key: 'remarks',  label: 'Remarks',    w: '8%' },
  { key: 'edit',     label: '',           w: '3%' },
]

/* ── Full view: all 26 columns, first two pinned ── */

const STICK_2 = 140
const FULL_COLS = [
  { key: 'invoice_number',        label: 'Invoice No',      w: 140, align: 'l', stick: 1 },
  { key: 'stockist_name',         label: 'Stockist',        w: 200, align: 'l', stick: 2 },
  { key: 'invoice_date',          label: 'Date',            w: 95,  align: 'l', type: 'date' },
  { key: 'payment_date',          label: 'Recd.Date',       w: 95,  align: 'l', type: 'date' },
  { key: 'invoice_received_date', label: 'Inv.Received',    w: 105, align: 'l', type: 'date' },
  { key: 'location_name',         label: 'Location',        w: 100, align: 'l' },
  { key: 'company_name',          label: 'Company',         w: 105, align: 'l' },
  { key: 'town',                  label: 'Town',            w: 120, align: 'l' },
  { key: 'psr_name',              label: 'PSR',             w: 135, align: 'l' },
  { key: 'stockist_mobile',       label: 'Mobile',          w: 115, align: 'l', mono: true },
  { key: 'invoice_amount',        label: 'Inv Amt',         w: 115, align: 'r', type: 'money' },
  { key: 'cn_dn_amount',          label: 'CN/DN',           w: 95,  align: 'r', type: 'money' },
  { key: 'net_outstanding',       label: 'Net Outstanding', w: 135, align: 'r', type: 'money' },
  { key: 'pdc_cheque_number',     label: 'PDC Cheque',      w: 110, align: 'l', mono: true },
  { key: 'pdc_date',              label: 'PDC Date',        w: 95,  align: 'l', type: 'date' },
  { key: 'pdc_amount',            label: 'PDC Amt',         w: 105, align: 'r', type: 'money' },
  { key: 'credit_days',           label: 'Credit',          w: 70,  align: 'c' },
  { key: 'due_date',              label: 'Due Date',        w: 95,  align: 'l', type: 'date' },
  { key: 'late',                  label: 'Delay',           w: 70,  align: 'c', type: 'delay' },
  { key: 'payment_received',      label: 'Paid Amt',        w: 115, align: 'r', type: 'money' },
  { key: 'payment_date_2',        label: 'Paid Date',       w: 95,  align: 'l', type: 'date', from: 'payment_date' },
  { key: 'owed',                  label: 'Balance',         w: 125, align: 'r', type: 'balance' },
  { key: 'call_status',           label: 'Status',          w: 100, align: 'l', type: 'status' },
  { key: 'risk_level',            label: 'Risk',            w: 95,  align: 'l', type: 'risk' },
  { key: 'calling_remarks_1',     label: 'Remarks 1',       w: 150, align: 'l' },
  { key: '__edit',                label: 'Edit',            w: 60,  align: 'c', type: 'edit' },
]
const FULL_W = FULL_COLS.reduce((s, c) => s + c.w, 0)
const FULL_GRID = FULL_COLS.map(c => `${c.w}px`).join(' ')

function alignStyle(align) {
  if (align === 'r') return { justifyContent: 'flex-end', textAlign: 'right' }
  if (align === 'c') return { justifyContent: 'center', textAlign: 'center' }
  return {}
}

const FullRow = memo(function FullRow({ inv, onEdit }) {
  const rowBg = ROW_BG[inv.call_status] ?? '#ffffff'
  function cell(c) {
    const raw = c.from ? inv[c.from] : inv[c.key]
    switch (c.type) {
      case 'date':    return <span className="text-xs text-muted">{fmtDateShort(raw)}</span>
      case 'money':   return <span className={`font-mono text-xs ${Number(raw) ? 'text-ink' : 'text-dim'}`}>{fmtCurrency(raw)}</span>
      case 'balance': return <span className="font-mono text-[13px] font-semibold text-ink">{fmtCurrency(raw)}</span>
      case 'delay':   return Number(raw) > 0 ? <span className="text-xs font-semibold text-bad">{raw}d</span> : <span className="text-xs text-dim">—</span>
      case 'status':  return <StatusBadge status={raw} />
      case 'risk':    return <RiskBadge level={raw} />
      case 'edit':    return (
        <button type="button" onClick={() => onEdit(inv)} aria-label={`Edit invoice ${inv.invoice_number}`}
          className="text-brand hover:text-brand-dark p-1"><Pencil size={14} /></button>
      )
      default:
        if (c.key === 'invoice_number') return <span className="font-mono text-[11.5px] font-semibold text-brand">{raw}</span>
        if (c.key === 'stockist_name') return (
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-ink text-[12.5px] truncate" title={raw}>{raw}</span>
            {inv.watchlist && <AlertTriangle size={11} className="text-bad shrink-0" aria-label="On watchlist" />}
          </span>
        )
        if (c.mono) return <span className="font-mono text-[11.5px] text-muted">{raw || '—'}</span>
        return <span className="text-xs text-muted truncate" title={raw ?? ''}>{raw ?? '—'}</span>
    }
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: FULL_GRID, background: rowBg }} className="border-b border-line-soft">
      {FULL_COLS.map(c => (
        <div key={c.key} style={{
          padding: '11px 12px', whiteSpace: 'nowrap', display: 'flex', minWidth: 0, alignItems: 'center', ...alignStyle(c.align),
          ...(c.stick ? { position: 'sticky', left: c.stick === 1 ? 0 : STICK_2, background: rowBg, zIndex: 2,
            boxShadow: c.stick === 2 ? '6px 0 8px -6px rgba(21,23,26,0.12)' : undefined } : {}),
        }}>
          {cell(c)}
        </div>
      ))}
    </div>
  )
})

/* ── Export: every filtered row, every column ── */

function exportExcel(list) {
  const header = [
    'Invoice No', 'Invoice Date', 'Recd. Date', 'Inv. Received Date',
    'Location', 'Company', 'Stockist', 'Town', 'PSR', 'Mobile',
    'Invoice Amount', 'CN / DN', 'Net Outstanding',
    'PDC Cheque', 'PDC Date', 'PDC Amount',
    'Credit Days', 'Due Date', 'Delay Days',
    'Paid Amount', 'Paid Date', 'Balance',
    'Status', 'Risk Level', 'Watchlist', 'Remarks 1', 'Remarks 2',
  ]
  const body = list.map(inv => [
    inv.invoice_number, inv.invoice_date, inv.payment_date ?? '', inv.invoice_received_date ?? '',
    inv.location_name, inv.company_name, inv.stockist_name, inv.town, inv.psr_name, inv.stockist_mobile,
    Number(inv.invoice_amount ?? 0), Number(inv.cn_dn_amount ?? 0), Number(inv.net_outstanding ?? 0),
    inv.pdc_cheque_number ?? '', inv.pdc_date ?? '', Number(inv.pdc_amount ?? 0),
    inv.credit_days, inv.due_date, inv.late,
    Number(inv.payment_received ?? 0), inv.payment_date ?? '', inv.owed,
    statusMeta(inv.call_status).label, inv.risk_level, inv.watchlist ? 'Yes' : 'No',
    inv.calling_remarks_1 ?? '', inv.calling_remarks_2 ?? '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  ws['!cols'] = header.map(() => ({ wch: 17 }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: header.length - 1, r: body.length } }) }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
  XLSX.writeFile(wb, `Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function InvoicesPage() {
  const { profile, isAdmin } = useAuth()
  const { companies, locations, allPsrs } = useMasterData()
  const { analysis, loading, error, refetch } = useLedger()

  const [searchRaw, setSearchRaw] = useState('')
  const [tab,       setTab]       = useState('all_due')
  const [company,   setCompany]   = useState('')
  const [psr,       setPsr]       = useState('')
  const [location,  setLocation]  = useState('')
  const [pageSize,  setPageSize]  = useState(50)
  const [page,      setPage]      = useState(1)
  const [sort,      setSort]      = useState({ key: 'priority', dir: 1 })
  const [full,      setFull]      = useState(false)
  const [modal,     setModal]     = useState(null)
  const [toast,     setToast]     = useState('')

  const search = useDebounced(searchRaw)
  const today = todayNum()

  useEffect(() => { setPage(1) }, [search, tab, company, psr, location, pageSize, sort])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const all = useMemo(
    () => (analysis?.invoices ?? []).map(r => ({ ...r, call_status: statusOf(r, today) })),
    [analysis, today])

  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter(r =>
      (!company  || r.company_id === company) &&
      (!psr      || r.psr_id === psr) &&
      (!location || r.location_id === location) &&
      (!q || String(r.invoice_number).toLowerCase().includes(q) || String(r.stockist_name).toLowerCase().includes(q)
          || String(r.town ?? '').toLowerCase().includes(q)))
  }, [all, search, company, psr, location])

  const tabs = useMemo(() => TABS.map(t => {
    const rows = base.filter(t.test)
    return { ...t, n: rows.length, amount: rows.reduce((s, r) => s + r.owed, 0) }
  }), [base])

  const list = useMemo(() => {
    const t = TABS.find(x => x.key === tab)
    const cmp = SORTS[sort.key]
    return base.filter(t.test).sort((a, b) => sort.dir * cmp(a, b) || String(a.invoice_number).localeCompare(String(b.invoice_number)))
  }, [base, tab, sort])

  const handleEdit = useCallback(inv => setModal(inv), [])

  const anyFilter = Boolean(search || company || psr || location)
  const clearFilters = () => { setSearchRaw(''); setCompany(''); setPsr(''); setLocation('') }
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const shown = list.slice((page - 1) * pageSize, page * pageSize)
  const from = list.length ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, list.length)
  const outstanding = list.reduce((s, r) => s + r.owed, 0)
  const collected = list.reduce((s, r) => s + (Number(r.payment_received) || 0), 0)
  const sel = on => `input w-auto px-2.5 text-[12.5px] ${on ? 'border-brand' : ''}`

  function toggleSort(key) {
    setSort(s => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'stockist' || key === 'company' ? 1 : -1 }))
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:py-5 md:h-full">

      {/* ── Title + actions ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shrink-0">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-[13px] text-muted mt-0.5">
            {loading ? 'Loading…' : `${list.length.toLocaleString('en-IN')} ${TABS.find(t => t.key === tab).label.toLowerCase()} invoice${list.length === 1 ? '' : 's'}${anyFilter ? ' matching your filters' : ''} · most urgent first unless you sort`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="inline-flex rounded-lg border border-line-input bg-white p-0.5" role="group" aria-label="Table view">
            <button type="button" aria-pressed={!full} onClick={() => setFull(false)}
              className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-md text-[12.5px] font-semibold ${!full ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}>
              <Rows3 size={14} aria-hidden="true" /> Compact
            </button>
            <button type="button" aria-pressed={full} onClick={() => setFull(true)}
              className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-md text-[12.5px] font-semibold ${full ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}>
              <Columns3 size={14} aria-hidden="true" /> All 26 columns
            </button>
          </div>
          <button type="button" onClick={() => exportExcel(list)} disabled={!list.length} className="btn-primary"
            title="Exports every invoice in this tab and filter, with all columns">
            <Download size={15} aria-hidden="true" /> Export Excel ({list.length.toLocaleString('en-IN')})
          </button>
          <button type="button" onClick={() => setModal({})} className="btn-secondary min-h-[42px]">
            <Plus size={14} aria-hidden="true" /> Add Invoice
          </button>
        </div>
      </div>

      {/* ── Status tabs: the at-a-glance summary ────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 shrink-0" role="tablist" aria-label="Invoice status">
        {tabs.map(t => {
          const on = tab === t.key
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
              className={`shrink-0 text-left rounded-xl border px-3.5 py-2.5 min-w-[118px] transition-colors ${
                on ? 'bg-brand border-brand' : 'bg-white border-line hover:border-line-input'}`}>
              <div className="flex items-center gap-2">
                {t.tone !== 'neutral' && t.tone !== 'brand' && (
                  <span className={`w-2 h-2 rounded-full ${TONE[t.tone].bar}`} aria-hidden="true" />
                )}
                <span className={`text-[12px] font-semibold ${on ? 'text-white' : 'text-muted'}`}>{t.label}</span>
                <span className={`ml-auto font-mono text-[12px] ${on ? 'text-brand-soft' : 'text-faint'}`}>{t.n}</span>
              </div>
              <div className={`font-mono text-[15px] font-semibold mt-0.5 tracking-[-0.02em] ${
                on ? 'text-white' : t.n === 0 ? 'text-dim' : t.tone === 'bad' ? 'text-bad' : 'text-ink'}`}>
                {t.noAmount ? `${t.n} settled` : fmtCurrency(t.amount)}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <Card className="px-3.5 py-2.5 flex flex-wrap gap-2 items-center shrink-0">
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input value={searchRaw} onChange={e => setSearchRaw(e.target.value)} type="search"
            aria-label="Search invoices" placeholder="Search invoice, stockist or town…"
            className="input pl-8 text-[12.5px] sm:w-[260px]" />
        </div>
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
        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} aria-label="Rows per page" className={sel(false)}>
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        {anyFilter && (
          <button type="button" onClick={clearFilters} className="btn-secondary px-3.5 text-[12.5px]">
            <X size={13} aria-hidden="true" /> Clear
          </button>
        )}
        <div className="w-full lg:w-auto lg:ml-auto flex gap-5 items-baseline">
          <span className="text-[12.5px] text-muted">
            Balance <b className="font-mono text-bad text-[14.5px]">{fmtCurrency(outstanding)}</b>
          </span>
          <span className="text-[12.5px] text-muted">
            Received <b className="font-mono text-good text-[14.5px]">{fmtCurrency(collected)}</b>
          </span>
        </div>
      </Card>

      {/* ── Table ───────────────────────────────────────────── */}
      <Card className="overflow-hidden flex flex-col md:flex-1 md:min-h-0">
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <div className={`md:flex-1 md:min-h-0 md:overflow-auto ${full ? 'overflow-auto max-h-[70vh] md:max-h-none' : ''}`}>
            {loading ? (
              <div className="px-6"><LoadingRows /></div>
            ) : list.length === 0 ? (
              anyFilter
                ? <NoResults query={search} what="invoice" onClear={clearFilters} />
                : <EmptyState title={tab === 'overdue' ? 'Nothing is late' : 'No invoices here'}
                    body={tab === 'overdue' ? 'Every dealer is inside their credit period.' : 'Try another tab above.'} />
            ) : full ? (
              <div style={{ minWidth: FULL_W }}>
                <div style={{ display: 'grid', gridTemplateColumns: FULL_GRID }} className="bg-surface border-b border-line sticky top-0 z-30">
                  {FULL_COLS.map(c => (
                    <div key={c.key} style={{
                      padding: '11px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', ...alignStyle(c.align),
                      ...(c.stick ? { position: 'sticky', left: c.stick === 1 ? 0 : STICK_2, background: '#faf9f5', zIndex: 40,
                        boxShadow: c.stick === 2 ? '6px 0 8px -6px rgba(21,23,26,0.12)' : undefined } : {}),
                    }} className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-faint">
                      {c.label}
                    </div>
                  ))}
                </div>
                {shown.map(inv => <FullRow key={inv.id} inv={inv} onEdit={handleEdit} />)}
              </div>
            ) : (
              <>
              <div className="md:hidden flex flex-col gap-2.5 p-2.5 bg-paper">
                {shown.map(r => <InvoiceCard key={r.id} r={r} today={today} onEdit={handleEdit} />)}
              </div>
              <table className="hidden md:table w-full min-w-[1080px] table-fixed border-collapse">
                <colgroup>{COMPACT_COLS.map(c => <col key={c.key} style={{ width: c.w }} />)}</colgroup>
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-line">
                    {COMPACT_COLS.map((c, i) => {
                      const active = sort.key === c.sort
                      return (
                        <th key={c.key} scope="col"
                          aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                          className={`py-2.5 pr-3 ${i === 0 ? 'pl-4' : ''} text-[10.5px] font-semibold uppercase tracking-[0.04em] text-faint ${c.right ? 'text-right pr-4' : 'text-left'}`}>
                          {c.sort ? (
                            <button type="button" onClick={() => toggleSort(c.sort)}
                              className={`inline-flex items-center gap-1 uppercase tracking-[0.04em] hover:text-ink ${active ? 'text-ink' : ''}`}>
                              {c.label}
                              {active && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </button>
                          ) : c.label || <span className="sr-only-label">Edit</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => <CompactRow key={r.id} r={r} today={today} onEdit={handleEdit} />)}
                </tbody>
              </table>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap px-4 md:px-5 py-2.5 border-t border-line shrink-0">
          <p className="text-xs text-faint">
            {list.length ? `Showing ${from}–${to} of ${list.length.toLocaleString('en-IN')}` : 'No rows'}
            {sort.key !== 'priority' && (
              <> · <button type="button" className="font-semibold text-brand" onClick={() => setSort({ key: 'priority', dir: 1 })}>back to most urgent first</button></>
            )}
            {full && ' · Invoice No and Stockist stay pinned while scrolling'}
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
          onSave={async (payload, id) => {
            await saveInvoice(payload, id, profile?.id)
            refetch()
            setToast(`Invoice ${payload.invoice_number} ${id ? 'updated' : 'saved'}`)
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
