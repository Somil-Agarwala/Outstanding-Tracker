import { format, addDays, differenceInDays, isToday, isTomorrow, isPast, parseISO } from 'date-fns'

// ── Formatting helpers ────────────────────────────────────────────

export function fmtCurrency(n) {
  const num = Number(n) || 0
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtDate(d) {
  if (!d) return '—'
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy') }
  catch { return '—' }
}

export function fmtDateShort(d) {
  if (!d) return '—'
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd/MM/yy') }
  catch { return '—' }
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

// ── Due date from invoice date + credit days ──────────────────────

export function calcDueDate(invoiceDate, creditDays) {
  if (!invoiceDate || creditDays == null) return null
  try {
    const base = typeof invoiceDate === 'string' ? parseISO(invoiceDate) : invoiceDate
    return addDays(base, Number(creditDays))
  } catch { return null }
}

// ── Delay in days (0 if not overdue) ─────────────────────────────

export function calcDelayDays(dueDateStr) {
  if (!dueDateStr) return 0
  try {
    const due = parseISO(dueDateStr)
    const diff = differenceInDays(new Date(), due)
    return diff > 0 ? diff : 0
  } catch { return 0 }
}

// ── Money helpers ─────────────────────────────────────────────────

/* Balance can go negative on overpayment. Never show that. */
export function unpaid(inv) {
  return Math.max(0, Number(inv?.balance ?? 0))
}

/* Part-paid but still owing money. */
export function isPartial(inv) {
  return Number(inv?.payment_received ?? 0) > 0 && Number(inv?.balance ?? 0) > 0
}

// ── Call status from an invoice_details row ───────────────────────
/*
   FIXED: the old version could never return 'partial', so the
   CALL_STATUS.partial entry was dead code and the 28 part-paid
   invoices in the DB were badged 'Upcoming' or 'Overdue' with no
   sign that money had already come in against them.

   Timing still wins when a call is actually needed — an overdue
   invoice is overdue whether or not it is part-paid. 'partial'
   only replaces the otherwise uninformative 'upcoming'.
*/
export function callStatus(inv) {
  const bal = Number(inv?.balance ?? 0)
  if (bal <= 0) return 'paid'

  let timing = 'upcoming'
  if (inv?.due_date) {
    try {
      const due = parseISO(inv.due_date)
      if (isPast(due) && !isToday(due)) timing = 'overdue'
      else if (isToday(due))            timing = 'due_today'
      else if (isTomorrow(due))         timing = 'call_due'
    } catch { /* fall through to 'upcoming' */ }
  }

  if (timing === 'upcoming' && isPartial(inv)) return 'partial'
  return timing
}

// ── Config maps ───────────────────────────────────────────────────

export const CALL_STATUS = {
  paid:     { label: 'Paid',      cls: 'badge-green'  },
  upcoming: { label: 'Upcoming',  cls: 'badge-blue'   },
  call_due: { label: 'Call Now',  cls: 'badge-orange' },
  due_today:{ label: 'Due Today', cls: 'badge-orange' },
  overdue:  { label: 'Overdue',   cls: 'badge-red'    },
  partial:  { label: 'Partial',   cls: 'badge-amber'  },
}

export const RISK = {
  low:      { label: 'Low Risk',      cls: 'badge-green',  dot: 'bg-emerald-400', bar: 'bg-emerald-400' },
  medium:   { label: 'Medium Risk',   cls: 'badge-amber',  dot: 'bg-amber-400',   bar: 'bg-amber-400'   },
  high:     { label: 'High Risk',     cls: 'badge-orange', dot: 'bg-orange-400',  bar: 'bg-orange-400'  },
  critical: { label: 'Critical Risk', cls: 'badge-red',    dot: 'bg-red-500',     bar: 'bg-red-500'     },
}

/*
   RISK is keyed lowercase. If anything ever writes 'High' or
   'CRITICAL' into stockists.risk_level, RISK[level] returns
   undefined and every dealer silently renders as "Low Risk" —
   a badge that says the opposite of the truth. Always look up
   through this.
*/
export function riskOf(level) {
  return RISK[String(level ?? '').toLowerCase()] ?? RISK.low
}

export function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}
