import { useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFinance } from '../../hooks/useFinance'
import { partyPnl, dayToISO } from '../../lib/profit'
import { fmtCurrency, fmtDate } from '../../lib/utils'
import { Card } from '../ui'

const signed = n => (n < 0 ? '−' : '') + fmtCurrency(Math.abs(n))

/* Admin-only card on the dealer screen: is this dealer making you money? */
export default function DealerPnlCard({ dealerId, invoices }) {
  const { finance, loans, history, loading, error, refetch } = useFinance({ stockistId: dealerId })

  // Reload the payment log after an invoice on this page is edited.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    refetch()
  }, [invoices]) // eslint-disable-line

  const res = useMemo(() => partyPnl(invoices, history, finance, loans), [invoices, history, finance, loans])
  const t = res.totals

  if (loading) return <Card className="px-6 py-[22px] text-[12.5px] text-faint">Working out this dealer's P&L…</Card>
  if (error) return <Card className="px-6 py-[22px]"><h2 className="h2">Profit & Loss</h2><p className="h2-sub">{error}</p></Card>

  const next = res.openBills.find(b => !b.inLoss && b.lossDay != null)
  const lines = [
    ['Margin after cost to serve', fmtCurrency(t.gross - t.serve), 'text-ink'],
    ['Interest within credit days', `−${fmtCurrency(t.inTerms)}`, 'text-muted'],
    ['Interest after due date', `−${fmtCurrency(t.overdue)}`, t.overdue > 0 ? 'text-bad' : 'text-muted'],
  ]

  return (
    <Card className="px-6 py-[22px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h2">Profit & Loss</h2>
        <Link to="/profit" className="link-more text-xs">All dealers ›</Link>
      </div>
      <p className="h2-sub mb-4">Every bill so far, after interest on the money they held.</p>

      {(res.rate == null || res.missingMargin.length > 0) && (
        <p className="mb-3 text-[12px] text-warn bg-warn-bg border border-warn-line rounded-lg px-3 py-2">
          {res.rate == null ? 'No loan entered, so interest shows as zero. ' : ''}
          {res.missingMargin.length ? `No margin set for ${res.missingMargin.join(', ')}. ` : ''}
          <Link to="/master" className="font-semibold">Set it in Master Data</Link>
        </p>
      )}

      <dl className="flex flex-col gap-2">
        {lines.map(([k, v, cls]) => (
          <div key={k} className="flex justify-between gap-3 text-[13px]">
            <dt className="text-muted">{k}</dt><dd className={`font-mono ${cls}`}>{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 pt-2 mt-1 border-t border-line">
          <dt className="text-[13.5px] font-semibold text-ink">Net P&L</dt>
          <dd className={`font-mono text-[15px] font-semibold ${t.pnl < 0 ? 'text-bad' : 'text-good'}`}>
            {signed(t.pnl)} <span className="text-[11.5px] font-normal text-faint">{t.sales ? `${(t.returnPct * 100).toFixed(1)}% of sales` : ''}</span>
          </dd>
        </div>
      </dl>

      {t.owed > 0 && (
        <p className="mt-3.5 text-[12.5px] text-muted leading-relaxed">
          Their unpaid {fmtCurrency(t.owed)} costs you {fmtCurrency(t.costPerDay)} a day.
          {t.lossBills > 0 && <span className="text-bad"> {t.lossBills} open bill{t.lossBills === 1 ? ' has' : 's have'} already lost money.</span>}
          {next && ` Next bill to turn loss-making: ${next.invoice_number} on ${fmtDate(dayToISO(next.lossDay))}.`}
        </p>
      )}
      {t.estimates > 0 && (
        <p className="mt-2 text-[11.5px] text-faint">{t.estimates} bill{t.estimates === 1 ? ' uses' : 's use'} an estimated payment date.</p>
      )}
    </Card>
  )
}
