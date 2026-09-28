/* Pure aggregations over invoice rows for Dashboard, Collections,
   Ageing, Dealers and Data Health. Dates are compared as whole UTC day
   numbers so timezones never shift an invoice across a due date. */

const DAY = 86400000

export function dayNum(iso) {
  if (!iso || typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10))
  if (!m || iso.length > 10 && iso[10] !== 'T') return null
  const y = Number(m[1])
  if (y < 1990 || y > 2100) return null
  return Math.floor(Date.UTC(y, Number(m[2]) - 1, Number(m[3])) / DAY)
}

export function todayNum() {
  const d = new Date()
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY)
}

export const BUCKETS = [
  { key: 'current', label: 'Current',    short: 'Not due', note: 'Nothing to do. This is normal trading.' },
  { key: 'd30',     label: '1–30 Days',  short: '< 1 mth', note: 'Where most of your risk usually is. Start here.' },
  { key: 'd60',     label: '31–60 Days', short: '1–2 mth', note: 'Call weekly. Still very collectable.' },
  { key: 'd90',     label: '61–90 Days', short: '2–3 mth', note: 'Hand to the location manager.' },
  { key: 'd90p',    label: '90+ Days',   short: '3 mth+',  note: 'Stop supplying until this clears.' },
]

export function bucketOf(late) {
  if (late <= 0)  return 'current'
  if (late <= 30) return 'd30'
  if (late <= 60) return 'd60'
  if (late <= 90) return 'd90'
  return 'd90p'
}

const emptyBuckets = () => Object.fromEntries(BUCKETS.map(b => [b.key, { amount: 0, count: 0 }]))

function enrich(r, today) {
  const due  = dayNum(r.due_date)
  const owed = Math.max(0, Number(r.balance) || 0)
  const late = owed > 0 && due != null && due < today ? today - due : 0
  return { ...r, owed, dueNum: due, late, isDueToday: owed > 0 && due === today }
}

function latestContact(invoices) {
  let best = null
  for (const i of invoices) {
    const remark = (i.calling_remarks_2 || i.calling_remarks_1 || '').trim()
    const called = dayNum(i.last_called_date)
    if (!remark && called == null) continue
    const when = called ?? dayNum((i.updated_at || '').slice(0, 10)) ?? 0
    if (!best || when > best.when) best = { when, called, remark }
  }
  return best
}

export function analyse(rows, today = todayNum()) {
  const inv = rows.map(r => enrich(r, today))

  const kpi = {
    outstanding: 0, openCount: 0,
    overdue: 0, overdueCount: 0,
    dueToday: 0, dueTodayDealers: [],
    collectedWeek: 0, paymentsWeek: 0,
  }
  const buckets = emptyBuckets()
  const byDealer = new Map()

  for (const i of inv) {
    if (i.owed > 0) {
      kpi.outstanding += i.owed
      kpi.openCount++
      const b = buckets[bucketOf(i.late)]
      b.amount += i.owed
      b.count++
    }
    if (i.late > 0) { kpi.overdue += i.owed; kpi.overdueCount++ }
    if (i.isDueToday) kpi.dueToday += i.owed

    const paid = dayNum(i.payment_date)
    if (paid != null && paid <= today && paid > today - 7 && Number(i.payment_received) > 0) {
      kpi.collectedWeek += Number(i.payment_received)
      kpi.paymentsWeek++
    }

    let d = byDealer.get(i.stockist_id)
    if (!d) {
      d = {
        id: i.stockist_id, name: i.stockist_name, town: i.town,
        mobile: i.stockist_mobile, psr: i.psr_name,
        location: i.location_name, location_id: i.location_id,
        risk_level: i.risk_level, risk_score: i.risk_score, watchlist: i.watchlist,
        owed: 0, overdue: 0, dueToday: 0, maxLate: 0, lateInvoices: 0,
        buckets: emptyBuckets(), invoices: [],
      }
      byDealer.set(i.stockist_id, d)
    }
    d.invoices.push(i)
    if (i.owed > 0) {
      d.owed += i.owed
      const b = d.buckets[bucketOf(i.late)]
      b.amount += i.owed
      b.count++
    }
    if (i.late > 0) {
      d.overdue += i.owed
      d.lateInvoices++
      d.maxLate = Math.max(d.maxLate, i.late)
    }
    if (i.isDueToday) d.dueToday += i.owed
  }

  const dealers = [...byDealer.values()]
  for (const d of dealers) {
    d.atStake = d.overdue + d.dueToday
    d.contact = latestContact(d.invoices)
  }

  const collections = dealers
    .filter(d => d.atStake > 0)
    .sort((a, b) => b.atStake - a.atStake)

  kpi.dueTodayDealers = dealers.filter(d => d.dueToday > 0).map(d => d.name)

  const late = dealers.filter(d => d.overdue > 0).sort((a, b) => b.overdue - a.overdue)
  const top5 = late.slice(0, 5).reduce((s, d) => s + d.overdue, 0)
  const concentration = {
    topDealer: late[0] ?? null,
    topShare:  kpi.overdue > 0 && late[0] ? late[0].overdue / kpi.overdue : 0,
    top5Share: kpi.overdue > 0 ? top5 / kpi.overdue : 0,
    lateDealers: late.length,
    lateInvoices: kpi.overdueCount,
  }

  const ageingByDealer = dealers
    .filter(d => d.owed > 0 && d.overdue > 0)
    .sort((a, b) => b.owed - a.owed)

  return { invoices: inv, kpi, buckets, dealers, collections, lateDealers: late, concentration, ageingByDealer }
}

/* ── Data health ────────────────────────────────────────────── */

function badDate(iso, today) {
  if (!iso) return false
  const n = dayNum(iso)
  return n == null || n > today
}

export function dataHealth(rows, today = todayNum()) {
  const groups = new Map()
  for (const r of rows) {
    const k = `${r.stockist_id}|${String(r.invoice_number ?? '').trim().toUpperCase()}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  const dupGroups = [...groups.values()].filter(g => g.length > 1)
    .sort((a, b) => b.length - a.length)
  const duplicates = dupGroups.flat()
  const dupExtra = dupGroups.reduce((s, g) => s + g.length - 1, 0)
  const dupImpact = dupGroups.reduce((s, g) => {
    const owed = g.map(r => Math.max(0, Number(r.balance) || 0)).sort((a, b) => b - a)
    return s + owed.slice(1).reduce((x, y) => x + y, 0)
  }, 0)

  const overpaid = rows.filter(r => Number(r.balance) < 0)
  const overpaidImpact = overpaid.reduce((s, r) => s - Number(r.balance), 0)

  const invalidDates = rows.filter(r => badDate(r.invoice_date, today) || badDate(r.payment_date, today))
  const missingPayDate = rows.filter(r => Number(r.payment_received) > 0 && !r.payment_date)

  return {
    duplicates: {
      key: 'duplicates', count: dupExtra, rows: duplicates, groups: dupGroups, impact: dupImpact,
      examples: dupGroups.slice(0, 2).map(g => ({ number: g[0].invoice_number, times: g.length })),
    },
    overpaid: { key: 'overpaid', count: overpaid.length, rows: overpaid, impact: overpaidImpact },
    invalidDates: { key: 'invalidDates', count: invalidDates.length, rows: invalidDates },
    missingPayDate: { key: 'missingPayDate', count: missingPayDate.length, rows: missingPayDate },
    total: dupExtra + overpaid.length + invalidDates.length + missingPayDate.length,
  }
}

/* ── One dealer ─────────────────────────────────────────────── */

/* Mirrors fn_recompute_risk so the breakdown adds up to the stored score. */
export function riskBreakdown(invoices, stockist, today = todayNum()) {
  const total = invoices.length
  let open = 0, settledLate = 0, overdueAmt = 0
  const delays = []
  for (const i of invoices) {
    const bal = Number(i.balance) || 0
    const due = dayNum(i.due_date)
    const paid = dayNum(i.payment_date)
    if (bal > 0 && due != null && due < today) {
      open++
      overdueAmt += bal
      delays.push(today - due)
    } else if (bal <= 0 && paid != null && due != null && paid > due) {
      settledLate++
      delays.push(paid - due)
    }
  }
  const lateEvents = open + settledLate
  const ratio = total > 0 ? Math.min(1, lateEvents / total) : 0
  const avgDelay = stockist?.avg_delay_days != null
    ? Number(stockist.avg_delay_days)
    : delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0

  return {
    total, lateEvents, ratio, avgDelay, overdueAmt,
    parts: [
      { key: 'freq',  label: 'How often they pay late',          pct: Math.min(40, lateEvents * 4) / 40,
        detail: `${lateEvents} late bill${lateEvents === 1 ? '' : 's'} out of ${total}` },
      { key: 'share', label: 'How much of their business is late', pct: ratio,
        detail: `${Math.round(ratio * 100)} out of every 100 bills` },
      { key: 'delay', label: 'How late they usually are',        pct: Math.min(avgDelay, 90) / 90,
        detail: `${Math.round(avgDelay)} days on average` },
      { key: 'amt',   label: 'How much is tied up',              pct: Math.min(overdueAmt, 500000) / 500000,
        detail: `${lakhs(overdueAmt)} of a ₹5L ceiling` },
    ],
  }
}

export function severityWord(key, pct) {
  const words = {
    freq:  ['Rarely', 'Sometimes', 'Often', 'Every time'],
    share: ['Very little', 'Some of it', 'A lot of it', 'Most of it'],
    delay: ['Not very', 'A little', 'Quite late', 'Very late'],
    amt:   ['Small', 'Moderate', 'Large', 'Almost the limit'],
  }[key]
  return words[pct >= 0.9 ? 3 : pct >= 0.5 ? 2 : pct >= 0.2 ? 1 : 0]
}

/* Average days late per month (by due date) for the last `months` months. */
export function delayTrend(invoices, months = 7, now = new Date()) {
  const today = todayNum()
  const out = []
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
    out.push({ y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleString('en-IN', { month: 'short' }), sum: 0, n: 0 })
  }
  for (const i of invoices) {
    const due = dayNum(i.due_date)
    if (due == null) continue
    const dd = new Date(due * DAY)
    const slot = out.find(o => o.y === dd.getUTCFullYear() && o.m === dd.getUTCMonth())
    if (!slot) continue
    const bal = Number(i.balance) || 0
    const paid = dayNum(i.payment_date)
    let delay = 0
    if (bal > 0 && due < today) delay = today - due
    else if (bal <= 0 && paid != null) delay = Math.max(0, paid - due)
    else continue
    slot.sum += delay
    slot.n++
  }
  return out.map(o => ({ label: o.label, avg: o.n ? o.sum / o.n : null }))
}

export function lakhs(n) {
  const v = Number(n) || 0
  if (v >= 100000) return `₹${(v / 100000).toFixed(2).replace(/\.?0+$/, '')}L`
  return '₹' + Math.round(v).toLocaleString('en-IN')
}
