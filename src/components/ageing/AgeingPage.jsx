import { Link, useNavigate } from 'react-router-dom'
import { useLedger } from '../../hooks/useLedger'
import { fmtCurrency } from '../../lib/utils'
import { BUCKETS } from '../../lib/ledger'
import { BUCKET_TONE } from '../Dashboard'
import { Card, Bar, PageHeader, PageLoading, PageError, EmptyState, pct } from '../ui'

export default function AgeingPage() {
  const navigate = useNavigate()
  const { analysis, loading, error, refetch } = useLedger()

  if (loading) return <PageLoading label="Sorting money by age…" />
  if (error)   return <PageError message={error} onRetry={refetch} />

  const { kpi, buckets, ageingByDealer, concentration: c } = analysis
  const maxBucket = Math.max(1, ...BUCKETS.map(b => buckets[b.key].amount))
  const oldest = buckets.d90p.count + buckets.d90.count

  return (
    <div className="page">
      <PageHeader
        title="Ageing Analysis"
        sub={`${fmtCurrency(kpi.outstanding)} is out with dealers. The longer it sits, the less of it comes back.`}
        action={<Link to="/collections" className="btn-primary min-h-[44px] px-5 text-sm">Open Collections ({analysis.collections.length})</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {BUCKETS.map(b => {
          const v = buckets[b.key]
          return (
            <Card key={b.key} className="px-[22px] py-5 min-w-0">
              <div className="text-[13px] font-semibold text-ink">{b.label}</div>
              <div className="font-mono text-[20px] xl:text-[23px] font-semibold text-ink mt-2.5 tracking-[-0.03em] truncate">{fmtCurrency(v.amount)}</div>
              <div className="text-xs text-faint mt-1">{v.count} invoice{v.count === 1 ? '' : 's'}</div>
              <div className="mt-3.5"><Bar pct={v.amount / maxBucket} tone={BUCKET_TONE[b.key]} height={6} /></div>
              <div className="text-xs text-muted mt-2.5 leading-snug">{b.note}</div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-[18px]">
        <Card className="px-6 py-[22px] flex flex-col min-w-0">
          <h2 className="h2">Ageing by Stockist</h2>
          <p className="h2-sub mb-3.5">Read across: the further right a number sits, the older that money is.</p>
          {ageingByDealer.length === 0 ? (
            <EmptyState title="Nothing is late" body="No dealer has money past its due date." />
          ) : (
            <div className="overflow-auto max-h-[560px] -mx-2 px-2">
              <table className="w-full min-w-[640px] border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-line">
                    <th className="col-head text-left pb-2.5 pr-2.5">Stockist</th>
                    {BUCKETS.map(b => <th key={b.key} className="col-head text-right pb-2.5 pl-2.5">{b.short}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ageingByDealer.map(d => (
                    <tr key={d.id} className="border-b border-line-soft cursor-pointer hover:bg-surface"
                      onClick={() => navigate(`/dealers/${d.id}`)}>
                      <td className="py-3 pr-2.5">
                        <Link to={`/dealers/${d.id}`} className="text-[13px] font-semibold text-ink hover:text-brand">{d.name}</Link>
                        <div className="text-[11.5px] text-faint">{d.town}</div>
                      </td>
                      {BUCKETS.map(b => {
                        const amt = d.buckets[b.key].amount
                        return (
                          <td key={b.key} className="py-3 pl-2.5 text-right font-mono">
                            {amt > 0
                              ? <span className={`text-[13px] font-semibold ${b.key === 'd90p' ? 'text-bad' : 'text-ink'}`}>{fmtCurrency(amt)}</span>
                              : <span className="text-[12.5px] text-dim">·</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="px-6 py-[22px] flex flex-col min-w-0">
          <h2 className="h2">Concentration Risk</h2>
          <p className="h2-sub mb-[18px]">Fewer dealers holding more money means fewer calls to make.</p>
          {c.lateDealers === 0 ? (
            <p className="text-[13px] text-good">No late money at all right now.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              <div className={`px-[18px] py-4 border rounded-[10px] ${c.topShare >= 0.2 ? 'bg-bad-bg border-bad-line' : 'bg-surface border-line'}`}>
                <div className={`font-mono text-2xl font-semibold ${c.topShare >= 0.2 ? 'text-bad' : 'text-ink'}`}>{pct(c.topShare)}</div>
                <div className={`text-[13px] mt-1 leading-snug ${c.topShare >= 0.2 ? 'text-bad-ink' : 'text-muted'}`}>
                  of all late money is with one dealer alone: {c.topDealer.name}.
                </div>
              </div>
              <div className="px-[18px] py-4 bg-surface border border-line rounded-[10px]">
                <div className="font-mono text-2xl font-semibold text-ink">{pct(c.top5Share)}</div>
                <div className="text-[13px] text-muted mt-1 leading-snug">
                  is with your top {Math.min(5, c.lateDealers)}. {c.lateDealers > 5 ? 'Five phone calls cover most of it.' : 'That is everyone who is late.'}
                </div>
              </div>
              <div className="px-[18px] py-4 bg-surface border border-line rounded-[10px]">
                <div className="font-mono text-2xl font-semibold text-ink">{c.lateDealers}</div>
                <div className="text-[13px] text-muted mt-1 leading-snug">
                  dealer{c.lateDealers === 1 ? ' is' : 's are'} late on something, across {c.lateInvoices} invoice{c.lateInvoices === 1 ? '' : 's'}.
                  {oldest > 0 && ` ${oldest} of those invoices are more than two months late.`}
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-5" aria-hidden="true" />
          <p className="pt-[18px] border-t border-line text-[12.5px] text-muted leading-relaxed">
            Age counts from the due date, not the invoice date. A dealer on 45 day credit is not marked late on day 31.
          </p>
        </Card>
      </div>
    </div>
  )
}
