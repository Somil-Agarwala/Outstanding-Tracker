/* WhatsApp click-to-chat payment reminders.

   No API and no server: we build a https://wa.me/ link that opens
   WhatsApp with the dealer's number and a prefilled Hindi message.
   The user still has to tap Send — WhatsApp allows nothing else
   from a link. Nothing is written to the database. */

import { dayNum, todayNum } from './ledger'

/* Shown as the sender in every message. Change it here only. */
export const FIRM_NAME = 'S.S. Commercial'

/* Longest list of bills we put in one message. Past this the link
   gets too long for some phones, so the rest is summarised. */
const MAX_BILLS = 10

/* '98390 12345', '+91-9839012345', '09839012345' → '919839012345'.
   Returns null for anything that is not an Indian mobile number, so
   a mistyped number gives a disabled button instead of a chat with
   a stranger. */
export function waNumber(mobile) {
  let d = String(mobile ?? '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? '91' + d : null
}

const rupees = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

/* '2026-09-02' → '02-09-2026' */
function ddmmyyyy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/* Works on raw invoice_details rows, so the dealer page and the
   Collections page produce exactly the same message. */
export function reminderMessage({ name, company, invoices = [] }, today = todayNum()) {
  const open = invoices
    .map(i => {
      const owed = Math.max(0, Number(i.balance) || 0)
      const due = dayNum(i.due_date)
      return { i, owed, due, late: due != null && due < today ? today - due : 0, dueToday: due === today }
    })
    .filter(b => b.owed > 0)
    .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity))

  if (!open.length) return null

  const total   = open.reduce((s, b) => s + b.owed, 0)
  const pressing = open.filter(b => b.late > 0 || b.dueToday)
  const overdue = open.filter(b => b.late > 0).reduce((s, b) => s + b.owed, 0)

  /* If something is late or due today, list only that. Otherwise
     this is an advance reminder, so list every open bill. */
  const list = pressing.length ? pressing : open
  const shown = list.slice(0, MAX_BILLS)

  const lines = shown.map(b => {
    /* Dealer-facing: dates and amounts only, no internal bill numbers. */
    const due = b.dueToday ? 'देय तिथि आज'
      : b.due != null ? `देय तिथि ${ddmmyyyy(b.i.due_date)}${b.late > 0 ? ` (${b.late} दिन ओवरड्यू)` : ''}`
      : null
    const dated = b.i.invoice_date ? `बिल दिनांक ${ddmmyyyy(b.i.invoice_date)}` : 'बिल'
    return `• ${[dated, rupees(b.owed), due].filter(Boolean).join(' – ')}`
  })
  if (list.length > shown.length) lines.push(`• और ${list.length - shown.length} बिल`)

  return [
    'नमस्ते,',
    `*${name}*`,
    '',
    `${FIRM_NAME}${company ? ` (${company})` : ''} की ओर से भुगतान का रिमाइंडर।`,
    '',
    `*कुल बकाया: ${rupees(total)}*`,
    overdue > 0 && overdue < total ? `इसमें से ओवरड्यू: ${rupees(overdue)}` : null,
    '',
    'बिल का विवरण:',
    ...lines,
    '',
    pressing.length
      ? 'कृपया जल्द से जल्द भुगतान करें।'
      : 'कृपया देय तिथि तक भुगतान करें।',
    'धन्यवाद।',
    FIRM_NAME,
  ].filter(l => l !== null).join('\n')
}

/* Full link, or null when the number is unusable or nothing is owed. */
export function reminderLink(dealer) {
  const to = waNumber(dealer?.mobile)
  if (!to) return null
  const text = reminderMessage(dealer)
  if (!text) return null
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
}
