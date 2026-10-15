/* Party P&L. Pure functions, no React, no Supabase.

   For every invoice:
     sales          = net invoice value (invoice + CN/DN)
     margin         = sales × company margin %
     cost to serve  = sales × company cost-to-serve %
     interest       = money still unpaid × loan rate ÷ 365, for every day
                      from the invoice date until each rupee came back
     net P&L        = margin − cost to serve − interest

   Interest is split at the due date: what accrued inside the dealer's
   credit days ("within terms") and what accrued after it ("overdue").
   Part-payments are applied on their own dates from payment_history, so a
   dealer who pays half early is charged interest only on the other half. */

import { dayNum, todayNum } from './ledger'

const YEAR = 365

/* Amount-weighted average rate of the active loans. If no amounts are
   entered, a plain average of their rates. null when there is no loan. */
export function effectiveRate(loans) {
  const live = (loans ?? []).filter(l => l.active && Number.isFinite(Number(l.rate_pct)))
  if (!live.length) return { rate: null, used: 0, count: 0 }
  const used = live.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const rate = used > 0
    ? live.reduce((s, l) => s + (Number(l.amount) || 0) * Number(l.rate_pct), 0) / used
    : live.reduce((s, l) => s + Number(l.rate_pct), 0) / live.length
  return { rate, used, count: live.length }
}

export function marginMap(financeRows) {
  const m = new Map()
  for (const r of financeRows ?? []) {
    const margin = Number(r.margin_pct) || 0
    const cost = Number(r.cost_to_serve_pct) || 0
    m.set(r.company_id, { margin, cost, net: margin - cost })
  }
  return m
}

/* Days a fully unpaid bill can stay out before interest eats the whole net margin. */
export function breakevenDays(netPct, ratePct) {
  if (!(ratePct > 0)) return null
  if (!(netPct > 0)) return 0
  return (netPct / ratePct) * YEAR
}

export function eventsByInvoice(history) {
  const m = new Map()
  for (const h of history ?? []) {
    const day = dayNum(h.payment_date)
    if (day == null) continue
    if (!m.has(h.invoice_id)) m.set(h.invoice_id, [])
    m.get(h.invoice_id).push({ day, amount: Number(h.amount) || 0, estimate: !!h.is_estimate })
  }
  return m
}

/* One invoice. Returns null when it cannot be costed (bad or future
   invoice date, or a zero / negative value such as a pure credit note). */
export function invoicePnl(inv, events, fin, ratePct, today = todayNum()) {
  const sales = Number(inv.net_outstanding) || 0
  const start = dayNum(inv.invoice_date)
  if (start == null || start > today || sales <= 0) return null

  const due = dayNum(inv.due_date) ?? start + (Number(inv.credit_days) || 0)
  const received = Number(inv.payment_received) || 0

  let evs = events ?? []
  let estimate = evs.some(e => e.estimate)
  const logged = evs.reduce((s, e) => s + e.amount, 0)
  if (Math.abs(logged - received) > 1) {
    // Log and invoice disagree (log not set up yet, or edited outside the
    // app): fall back to the invoice's single total and date.
    evs = received ? [{ day: dayNum(inv.payment_date) ?? due, amount: received }] : []
    estimate = received > 0
  }
  evs = [...evs].sort((a, b) => a.day - b.day)

  const daily = ratePct > 0 ? ratePct / 100 / YEAR : 0
  let owed = sales, cursor = start, inTerms = 0, overdue = 0

  const accrue = to => {
    if (to > cursor && owed > 0 && daily > 0) {
      const termsDays = Math.max(0, Math.min(to, due) - cursor)
      const overDays  = Math.max(0, to - Math.max(cursor, due))
      inTerms += owed * daily * termsDays
      overdue += owed * daily * overDays
    }
    cursor = Math.max(cursor, to)
  }

  let paidSoFar = 0
  for (const e of evs) {
    accrue(e.day)                                   // paid before the bill date costs nothing
    paidSoFar += e.amount                           // running total, so corrections net out
    owed = Math.min(sales, Math.max(0, sales - paidSoFar))
  }
  accrue(today)

  const m = fin ?? { margin: 0, cost: 0, net: 0 }
  const gross = sales * m.margin / 100
  const serve = sales * m.cost / 100
  const interest = inTerms + overdue
  const pnl = gross - serve - interest
  const costPerDay = owed * daily

  let lossDay = null, inLoss = false
  if (owed > 0 && costPerDay > 0) {
    if (pnl <= 0) inLoss = true
    else lossDay = today + Math.ceil(pnl / costPerDay)
  }

  return {
    id: inv.id, invoice_number: inv.invoice_number, invoice_date: inv.invoice_date, due_date: inv.due_date,
    stockist_id: inv.stockist_id, company_id: inv.company_id,
    sales, gross, serve, inTerms, overdue, interest, pnl,
    owed, late: owed > 0 && due < today ? today - due : 0,
    costPerDay, lossDay, inLoss, estimate, noMargin: !fin,
  }
}

const PERIODS = {
  fy:  'This financial year',
  d90: 'Last 90 days',
  d30: 'Last 30 days',
  all: 'All time',
}
export const PERIOD_LABELS = PERIODS

export function periodStart(key, now = new Date()) {
  if (key === 'all') return null
  const today = todayNum()
  if (key === 'd30') return today - 30
  if (key === 'd90') return today - 90
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return Math.floor(Date.UTC(fyYear, 3, 1) / 86400000)
}

const blank = () => ({
  sales: 0, gross: 0, serve: 0, inTerms: 0, overdue: 0, interest: 0, pnl: 0,
  owed: 0, overdueOwed: 0, costPerDay: 0, bills: 0, openBills: 0, lossBills: 0, estimates: 0,
})

function add(t, r) {
  t.sales += r.sales; t.gross += r.gross; t.serve += r.serve
  t.inTerms += r.inTerms; t.overdue += r.overdue; t.interest += r.interest; t.pnl += r.pnl
  t.owed += r.owed; t.costPerDay += r.costPerDay; t.bills++
  if (r.late > 0) t.overdueOwed += r.owed
  if (r.owed > 0) t.openBills++
  if (r.inLoss) t.lossBills++
  if (r.estimate) t.estimates++
}

/* Everything the P&L screen needs, from invoice_details rows. */
export function partyPnl(rows, history, financeRows, loans, { from = null, today = todayNum() } = {}) {
  const { rate } = effectiveRate(loans)
  const fin = marginMap(financeRows)
  const evs = eventsByInvoice(history)

  const totals = blank()
  const dealers = new Map()
  const companies = new Map()
  const bills = []
  const missingMargin = new Set()
  let skipped = 0

  for (const inv of rows ?? []) {
    const start = dayNum(inv.invoice_date)
    if (from != null && start != null && start < from) continue
    const f = fin.get(inv.company_id)
    const r = invoicePnl(inv, evs.get(inv.id), f, rate, today)
    if (!r) { if (Number(inv.net_outstanding) > 0) skipped++; continue }
    if (!f && inv.company_name) missingMargin.add(inv.company_name)

    r.stockist_name = inv.stockist_name
    r.town = inv.town
    r.company_name = inv.company_name
    r.location_name = inv.location_name
    bills.push(r)
    add(totals, r)

    let d = dealers.get(inv.stockist_id)
    if (!d) {
      d = {
        id: inv.stockist_id, name: inv.stockist_name, town: inv.town,
        company: inv.company_name, location: inv.location_name, location_id: inv.location_id,
        psr: inv.psr_name, risk_level: inv.risk_level, ...blank(),
      }
      dealers.set(inv.stockist_id, d)
    }
    add(d, r)

    let c = companies.get(inv.company_id)
    if (!c) {
      c = { id: inv.company_id, name: inv.company_name, ...(f ?? { margin: null, cost: null, net: null }), ...blank() }
      companies.set(inv.company_id, c)
    }
    add(c, r)
  }

  const finish = x => ({ ...x, returnPct: x.sales > 0 ? x.pnl / x.sales : 0 })

  return {
    rate,
    totals: finish(totals),
    dealers: [...dealers.values()].map(finish),
    companies: [...companies.values()].map(finish).sort((a, b) => b.sales - a.sales),
    openBills: bills.filter(b => b.owed > 0).sort((a, b) => (a.inLoss === b.inLoss ? (a.lossDay ?? 0) - (b.lossDay ?? 0) : a.inLoss ? -1 : 1)),
    missingMargin: [...missingMargin].sort(),
    skipped,
  }
}

export function dayToISO(n) {
  if (n == null) return null
  return new Date(n * 86400000).toISOString().slice(0, 10)
}
