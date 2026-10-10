import { MessageCircle } from 'lucide-react'
import { reminderLink, waNumber } from '../lib/whatsapp'

/* Opens WhatsApp with a prefilled Hindi payment reminder.

   dealer = { name, mobile, company, invoices }   (invoice_details rows)

   Renders a greyed-out, explained state instead of a dead link when
   the number is missing or mistyped, or when nothing is owed. */
export default function WhatsAppButton({ dealer, label = 'WhatsApp', className = '', iconSize = 15 }) {
  const href = reminderLink(dealer)

  if (!href) {
    const why = !dealer?.mobile ? 'No mobile number saved for this dealer'
      : !waNumber(dealer.mobile) ? `"${dealer.mobile}" is not a valid 10-digit mobile number`
      : 'This dealer owes nothing right now'
    return (
      <span title={why} aria-label={`WhatsApp unavailable: ${why}`}
        className={`inline-flex items-center justify-center gap-2 font-semibold text-faint bg-surface border border-line cursor-not-allowed ${className}`}>
        <MessageCircle size={iconSize} aria-hidden="true" /> {label}
      </span>
    )
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`Send a payment reminder to ${dealer.name} on WhatsApp`}
      className={`inline-flex items-center justify-center gap-2 font-semibold text-white bg-emerald-700 border border-emerald-700 hover:bg-emerald-800 hover:border-emerald-800 hover:text-white transition-colors ${className}`}>
      <MessageCircle size={iconSize} aria-hidden="true" /> {label}
    </a>
  )
}
