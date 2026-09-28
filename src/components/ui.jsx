import { Link, useNavigate } from 'react-router-dom'
import { Search, AlertCircle, Lock, RefreshCw } from 'lucide-react'
import { fmtCurrency } from '../lib/utils'

export const TONE = {
  bad:     { text: 'text-bad',   badge: 'bg-bad-bg border-bad-line text-bad',     bar: 'bg-bad',   box: 'bg-bad-bg border-bad-line',   ink: 'text-bad-ink' },
  warn:    { text: 'text-warn',  badge: 'bg-warn-bg border-warn-line text-warn',  bar: 'bg-warn',  box: 'bg-warn-bg border-warn-line', ink: 'text-warn-ink' },
  good:    { text: 'text-good',  badge: 'bg-good-bg border-good-line text-good',  bar: 'bg-good',  box: 'bg-good-bg border-good-line', ink: 'text-good-ink' },
  neutral: { text: 'text-muted', badge: 'bg-surface border-line text-muted',      bar: 'bg-faint', box: 'bg-surface border-line',      ink: 'text-muted' },
  brand:   { text: 'text-brand', badge: 'bg-indigo-50 border-indigo-200 text-brand', bar: 'bg-brand', box: 'bg-indigo-50 border-indigo-200', ink: 'text-brand' },
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-block text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap ${TONE[tone].badge} ${className}`}>
      {children}
    </span>
  )
}

const RISK_META = {
  critical: { label: 'Critical', tone: 'bad' },
  high:     { label: 'High',     tone: 'bad' },
  medium:   { label: 'Medium',   tone: 'warn' },
  low:      { label: 'Low',      tone: 'good' },
}

export function riskMeta(level) {
  return RISK_META[String(level ?? '').toLowerCase()] ?? RISK_META.low
}

export function RiskBadge({ level, suffix = '' }) {
  const m = riskMeta(level)
  return <Badge tone={m.tone}>{m.label}{suffix}</Badge>
}

const STATUS_META = {
  overdue:   { label: 'Overdue',   tone: 'bad' },
  due_today: { label: 'Due Today', tone: 'warn' },
  call_due:  { label: 'Call Due',  tone: 'warn' },
  partial:   { label: 'Partial',   tone: 'warn' },
  upcoming:  { label: 'Upcoming',  tone: 'neutral' },
  paid:      { label: 'Paid',      tone: 'good' },
}

export function statusMeta(s) {
  return STATUS_META[s] ?? STATUS_META.upcoming
}

export function StatusBadge({ status }) {
  const m = statusMeta(status)
  return <Badge tone={m.tone}>{m.label}</Badge>
}

export function Money({ value, className = '', dimZero = false }) {
  const n = Number(value) || 0
  return (
    <span className={`font-mono tracking-[-0.02em] ${dimZero && n === 0 ? 'text-dim' : ''} ${className}`}>
      {fmtCurrency(n)}
    </span>
  )
}

export function Card({ className = '', children, ...rest }) {
  return <div className={`bg-white border border-line rounded-xl ${className}`} {...rest}>{children}</div>
}

export function PageHeader({ title, sub, action, children }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="min-w-0">
        {children ?? <h1 className="page-title">{title}</h1>}
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {action && <div className="flex gap-2 flex-wrap shrink-0">{action}</div>}
    </div>
  )
}

export function Kpi({ label, value, sub, tone = 'neutral', size = 26 }) {
  return (
    <Card className="px-5 py-[18px] min-w-0">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="font-mono font-semibold text-ink mt-2 tracking-[-0.03em] truncate"
        style={{ fontSize: size }}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${TONE[tone].text}`}>{sub}</div>}
    </Card>
  )
}

export function Bar({ pct, tone = 'brand', height = 7 }) {
  const w = Math.max(0, Math.min(100, pct * 100))
  return (
    <div className="bg-track rounded" style={{ height }}>
      <div className={`${TONE[tone].bar} rounded`} style={{ width: `${w}%`, height, minWidth: w > 0 ? 3 : 0 }} />
    </div>
  )
}

export function Tel({ number, className = '' }) {
  if (!number) return <span className="text-dim">—</span>
  return (
    <a href={`tel:${String(number).replace(/[^\d+]/g, '')}`}
      onClick={e => e.stopPropagation()}
      className={`font-mono text-[12.5px] text-muted hover:text-brand ${className}`}>
      {number}
    </a>
  )
}

/* ── States ──────────────────────────────────────────────────── */

function StateBox({ children }) {
  return (
    <div className="flex items-center justify-center py-12 px-5">
      <div className="text-center max-w-[340px]">{children}</div>
    </div>
  )
}

export function LoadingRows({ rows = 6, label = 'Fetching your invoices…' }) {
  const widths = [[26, 18, 14], [21, 22, 11], [30, 15, 16], [19, 20, 13], [24, 17, 12], [28, 19, 15]]
  return (
    <div className="flex flex-col gap-[11px] py-6 px-1" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => {
        const [a, b, c] = widths[i % widths.length]
        return (
          <div key={i} className="flex gap-3 items-center animate-shimmer">
            <div className="h-[13px] bg-track rounded" style={{ width: `${a}%` }} />
            <div className="h-[13px] bg-line-soft rounded" style={{ width: `${b}%` }} />
            <div className="h-[13px] bg-line-soft rounded ml-auto" style={{ width: `${c}%` }} />
          </div>
        )
      })}
      <div className="text-[12.5px] text-faint mt-2">{label}</div>
    </div>
  )
}

export function PageLoading({ label }) {
  return (
    <div className="page">
      <div className="h-8 w-64 bg-track rounded animate-shimmer" />
      <Card className="px-6"><LoadingRows label={label} /></Card>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  const navigate = useNavigate()
  const offline = /fetch|network|failed to/i.test(message ?? '')
  return (
    <StateBox>
      <AlertCircle size={40} strokeWidth={1.6} className="mx-auto text-bad" aria-hidden="true" />
      <div className="text-base font-semibold text-ink mt-3.5">
        {offline ? 'Could not reach the server' : 'Something went wrong loading this'}
      </div>
      <p className="mt-2 mb-4 text-[13px] text-muted leading-relaxed">
        {offline ? 'Your internet may have dropped. ' : `${message} `}Nothing you entered has been lost.
      </p>
      <div className="flex gap-2 justify-center">
        {onRetry && <button type="button" onClick={onRetry} className="btn-primary min-h-[40px]"><RefreshCw size={14} /> Retry</button>}
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Go Back</button>
      </div>
    </StateBox>
  )
}

export function PageError(props) {
  return <div className="page"><Card><ErrorState {...props} /></Card></div>
}

export function EmptyState({ title, body, linkTo, linkLabel }) {
  return (
    <StateBox>
      <div className="text-base font-semibold text-ink">{title}</div>
      {body && <p className="mt-2 mb-4 text-[13px] text-muted leading-relaxed">{body}</p>}
      {linkTo && <Link to={linkTo} className="link-more">{linkLabel} ›</Link>}
    </StateBox>
  )
}

export function NoResults({ query, what = 'dealer', onClear }) {
  return (
    <StateBox>
      <Search size={40} strokeWidth={1.6} className="mx-auto text-faint" aria-hidden="true" />
      <div className="text-base font-semibold text-ink mt-3.5">
        {query ? <>No {what} matching &ldquo;{query}&rdquo;</> : <>Nothing matches these filters</>}
      </div>
      <p className="mt-2 mb-4 text-[13px] text-muted leading-relaxed">
        Check the spelling, or search by town instead.
      </p>
      {onClear && <button type="button" onClick={onClear} className="btn-secondary">Clear Filters</button>}
    </StateBox>
  )
}

export function AccessDenied({ what, who }) {
  return (
    <StateBox>
      <Lock size={40} strokeWidth={1.6} className="mx-auto text-faint" aria-hidden="true" />
      <div className="text-base font-semibold text-ink mt-3.5">{what}</div>
      <p className="mt-2 text-[13px] text-muted leading-relaxed">{who}</p>
    </StateBox>
  )
}

export function Pager({ page, totalPages, setPage, compact = false }) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-[12.5px] text-muted mr-1">Page {page} of {totalPages}</span>
      {!compact && <button type="button" className="btn-secondary min-h-[34px] px-3 text-xs" disabled={page <= 1} onClick={() => setPage(1)}>First</button>}
      <button type="button" className="btn-secondary min-h-[34px] px-3 text-xs" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
      <button type="button" className="btn-secondary min-h-[34px] px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
      {!compact && <button type="button" className="btn-secondary min-h-[34px] px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</button>}
    </div>
  )
}

export function pct(n) {
  return `${Math.round((Number(n) || 0) * 100)}%`
}

export function daysLabel(late, dueToday) {
  if (late > 0) return `${late}`
  if (dueToday) return 'due today'
  return '—'
}
