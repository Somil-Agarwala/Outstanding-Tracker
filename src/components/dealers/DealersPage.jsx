import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useWatchlist } from '../../hooks/useWatchlist'
import { fmtCurrency } from '../../lib/utils'
import { Card, RiskBadge, Badge, PageHeader, PageLoading, PageError, NoResults, Pager } from '../ui'

const PAGE = 25

const CHIPS = [
  { key: 'owing', label: 'Owes Money',    test: d => Number(d.total_balance) > 0 },
  { key: 'late',  label: 'Late',          test: d => Number(d.current_overdue) > 0 },
  { key: 'risk',  label: 'High Risk',     test: d => ['high', 'critical'].includes(String(d.risk_level).toLowerCase()) },
  { key: 'watch', label: 'Watchlist',     test: d => d.watchlist },
  { key: 'all',   label: 'All',           test: () => true },
]

export default function DealersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { dealers, loading, error, refetch } = useWatchlist()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const chip = CHIPS.some(c => c.key === params.get('show')) ? params.get('show') : 'owing'

  useEffect(() => { setPage(1) }, [q, chip])

  if (loading && !dealers.length) return <PageLoading label="Loading dealers…" />
  if (error) return <PageError message={error} onRetry={refetch} />

  const active = CHIPS.find(c => c.key === chip)
  const needle = q.trim().toLowerCase()
  const list = dealers
    .filter(active.test)
    .filter(d => !needle || d.name?.toLowerCase().includes(needle) || d.town?.toLowerCase().includes(needle)
      || d.psr_name?.toLowerCase().includes(needle))
    .sort((a, b) => Number(b.total_balance) - Number(a.total_balance) || Number(b.risk_score) - Number(a.risk_score))
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice((page - 1) * PAGE, page * PAGE)

  return (
    <div className="page">
      <PageHeader title="Dealers" sub="Every stockist, biggest balance first. Open one to see their full payment record." />

      <Card className="flex flex-col min-w-0">
        <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-line flex-wrap">
          <label htmlFor="dq" className="sr-only-label">Search dealers</label>
          <input id="dq" type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search stockist, town or PSR…" className="input w-full sm:w-[260px]" />
          <span className="hidden sm:block w-px h-6 bg-line mx-1" aria-hidden="true" />
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5" role="group" aria-label="Filter">
            {CHIPS.map(c => (
              <button key={c.key} type="button" aria-pressed={chip === c.key}
                className={chip === c.key ? 'chip-on' : 'chip'}
                onClick={() => setParams(c.key === 'owing' ? {} : { show: c.key }, { replace: true })}>
                {c.label} ({dealers.filter(c.test).length})
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <NoResults query={q.trim()} onClear={() => { setQ(''); setParams({}, { replace: true }) }} />
        ) : (
          <div className="px-3 md:px-5 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="col-head py-3 pr-3.5">Stockist</th>
                  <th className="col-head py-3 pr-3.5 hidden lg:table-cell">PSR</th>
                  <th className="col-head py-3 pr-3.5 hidden lg:table-cell">Company</th>
                  <th className="col-head py-3 pr-3.5 text-right">Outstanding</th>
                  <th className="col-head py-3 pr-3.5 text-right hidden sm:table-cell">Overdue</th>
                  <th className="col-head py-3 pr-3.5 hidden md:table-cell">Risk</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(d => (
                  <tr key={d.id} className="border-b border-line-soft cursor-pointer hover:bg-surface"
                    onClick={() => navigate(`/dealers/${d.id}`)}>
                    <td className="py-3.5 pr-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/dealers/${d.id}`} className="text-[13.5px] font-semibold text-ink hover:text-brand">{d.name}</Link>
                        {d.watchlist && <Badge tone="warn">Watchlist</Badge>}
                      </div>
                      <div className="text-[11.5px] text-faint mt-0.5">{[d.town, d.location_name].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="py-3.5 pr-3.5 text-[12.5px] text-muted hidden lg:table-cell">{d.psr_name ?? '—'}</td>
                    <td className="py-3.5 pr-3.5 text-[12.5px] text-muted hidden lg:table-cell">{d.company_name ?? '—'}</td>
                    <td className="py-3.5 pr-3.5 text-right font-mono text-sm font-semibold text-ink">{fmtCurrency(d.total_balance)}</td>
                    <td className={`py-3.5 pr-3.5 text-right font-mono text-[13px] hidden sm:table-cell ${Number(d.current_overdue) > 0 ? 'text-bad font-semibold' : 'text-dim'}`}>
                      {fmtCurrency(d.current_overdue)}
                    </td>
                    <td className="py-3.5 pr-3.5 hidden md:table-cell">
                      <span className="inline-flex items-center gap-2">
                        <RiskBadge level={d.risk_level} />
                        <span className="font-mono text-xs text-faint">{d.risk_score ?? 0}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 md:px-5 py-3.5 border-t border-line">
            <span className="text-[12.5px] text-faint">
              {list.length} dealer{list.length === 1 ? '' : 's'} · {fmtCurrency(list.reduce((s, d) => s + Number(d.total_balance || 0), 0))} outstanding
            </span>
            {totalPages > 1 && <Pager page={page} totalPages={totalPages} setPage={setPage} compact />}
          </div>
        )}
      </Card>
    </div>
  )
}
