import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import { useLedger } from '../../hooks/useLedger'
import { fmtCurrency } from '../../lib/utils'
import {
  Card, RiskBadge, PageHeader, PageLoading, PageError, EmptyState, NoResults, Tel, Pager, daysLabel,
} from '../ui'

const PAGE = 20
const DAY = 86400000

function contactText(c) {
  if (!c) return { text: 'Never called', tone: 'text-bad' }
  const when = c.called != null
    ? new Date(c.called * DAY).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    : null
  const text = [when, c.remark].filter(Boolean).join(' · ')
  return { text, tone: 'text-muted' }
}

function exportList(list) {
  const header = ['Stockist', 'Town', 'Location', 'PSR', 'Mobile', 'Late + due today', 'Days late (oldest)', 'Risk', 'Last contact']
  const body = list.map(d => [
    d.name, d.town ?? '', d.location ?? '', d.psr ?? '', d.mobile ?? '',
    Math.round(d.atStake), d.maxLate, d.risk_level ?? '', contactText(d.contact).text,
  ])
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  ws['!cols'] = header.map((_, i) => ({ wch: i === 0 ? 28 : 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Collections')
  XLSX.writeFile(wb, `Collections_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function CollectionsPage() {
  const navigate = useNavigate()
  const { analysis, loading, error, refetch } = useLedger()
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('all')
  const [page, setPage] = useState(1)

  const all = analysis?.collections ?? []
  const locations = useMemo(() => {
    const m = new Map()
    for (const d of all) m.set(d.location, (m.get(d.location) ?? 0) + 1)
    return [...m.entries()].filter(([name]) => name)
  }, [all])

  const chips = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'never', label: 'Not Contacted', test: d => !d.contact },
    { key: 'watch', label: 'Watchlist', test: d => d.watchlist },
    ...(locations.length > 1 ? locations.map(([name]) => ({ key: `loc:${name}`, label: name, test: d => d.location === name })) : []),
  ].map(c => ({ ...c, n: all.filter(c.test).length }))

  const active = chips.find(c => c.key === chip) ?? chips[0]
  const needle = q.trim().toLowerCase()
  const list = all.filter(active.test).filter(d =>
    !needle || d.name?.toLowerCase().includes(needle) || d.town?.toLowerCase().includes(needle))

  useEffect(() => { setPage(1) }, [q, chip])

  if (loading) return <PageLoading label="Building your call list…" />
  if (error)   return <PageError message={error} onRetry={refetch} />

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice((page - 1) * PAGE, page * PAGE)
  const listTotal = list.reduce((s, d) => s + d.atStake, 0)
  const clear = () => { setQ(''); setChip('all') }

  return (
    <div className="page">
      <PageHeader
        title="Collections"
        sub="Sorted by how much money is at stake, not by name. Work down the list."
        action={
          <button type="button" className="btn-primary min-h-[44px] px-5 text-sm" disabled={!list.length}
            onClick={() => exportList(list)}>
            <Download size={15} aria-hidden="true" /> Export List ({list.length})
          </button>
        }
      />

      <Card className="flex flex-col min-w-0">
        <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-line flex-wrap">
          <label htmlFor="cq" className="sr-only-label">Search dealers</label>
          <input id="cq" type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search stockist or town…" className="input w-full sm:w-[240px]" />
          <span className="hidden sm:block w-px h-6 bg-line mx-1" aria-hidden="true" />
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5" role="group" aria-label="Filter">
            {chips.map(c => (
              <button key={c.key} type="button" aria-pressed={chip === c.key}
                className={chip === c.key ? 'chip-on' : 'chip'} onClick={() => setChip(c.key)}>
                {c.label} ({c.n})
              </button>
            ))}
          </div>
        </div>

        {all.length === 0 ? (
          <EmptyState title="Nothing is late today"
            body="Every dealer is inside their credit period. Nobody needs a call."
            linkTo="/ageing" linkLabel="Look at what is coming up" />
        ) : list.length === 0 ? (
          <NoResults query={q.trim()} onClear={clear} />
        ) : (
          <>
            {/* phone: cards */}
            <div className="md:hidden flex flex-col gap-3 p-3 bg-paper">
              {shown.map(d => {
                const c = contactText(d.contact)
                return (
                  <div key={d.id} className="bg-white border border-line rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="text-[15px] font-bold text-ink truncate">{d.name}</div>
                        <div className="text-xs text-faint mt-0.5">{d.town}{d.psr ? ` · ${d.psr}` : ''}</div>
                      </div>
                      <RiskBadge level={d.risk_level} />
                    </div>
                    <div className="flex items-baseline gap-2.5 mt-3">
                      <span className="font-mono text-[21px] font-semibold text-ink">{fmtCurrency(d.atStake)}</span>
                      <span className={`text-[12.5px] font-semibold ${d.maxLate > 0 ? 'text-bad' : 'text-warn'}`}>
                        {d.maxLate > 0 ? `${d.maxLate} days late` : 'due today'}
                      </span>
                    </div>
                    <div className={`text-xs mt-1.5 ${c.tone}`}>{c.text}</div>
                    <div className="flex gap-2.5 mt-3.5">
                      {d.mobile
                        ? <a href={`tel:${d.mobile.replace(/[^\d+]/g, '')}`} className="flex-1 min-h-[46px] flex items-center justify-center text-sm font-semibold text-white bg-brand rounded-[10px] hover:text-white">Call</a>
                        : <span className="flex-1 min-h-[46px] flex items-center justify-center text-sm text-faint bg-surface rounded-[10px]">No number</span>}
                      <Link to={`/dealers/${d.id}`} className="flex-1 min-h-[46px] flex items-center justify-center text-sm font-semibold text-muted bg-white border border-line-input rounded-[10px]">Details</Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* desktop: table */}
            <div className="hidden md:block px-5 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="col-head py-3 pr-3.5">Stockist</th>
                    <th className="col-head py-3 pr-3.5">PSR</th>
                    <th className="col-head py-3 pr-3.5">Mobile</th>
                    <th className="col-head py-3 pr-3.5 text-right">Balance</th>
                    <th className="col-head py-3 pr-3.5 text-right">Delay</th>
                    <th className="col-head py-3 pr-3.5">Risk</th>
                    <th className="col-head py-3">Last Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(d => {
                    const c = contactText(d.contact)
                    return (
                      <tr key={d.id} className="border-b border-line-soft cursor-pointer hover:bg-surface"
                        onClick={() => navigate(`/dealers/${d.id}`)}>
                        <td className="py-3.5 pr-3.5">
                          <Link to={`/dealers/${d.id}`} className="text-[13.5px] font-semibold text-ink hover:text-brand">{d.name}</Link>
                          <div className="text-[11.5px] text-faint mt-0.5">{d.town}{d.location && d.location !== d.town ? ` · ${d.location}` : ''}</div>
                        </td>
                        <td className="py-3.5 pr-3.5 text-[12.5px] text-muted">{d.psr ?? '—'}</td>
                        <td className="py-3.5 pr-3.5"><Tel number={d.mobile} /></td>
                        <td className="py-3.5 pr-3.5 text-right font-mono text-sm font-semibold text-ink">{fmtCurrency(d.atStake)}</td>
                        <td className={`py-3.5 pr-3.5 text-right text-[12.5px] font-semibold ${d.maxLate > 0 ? 'text-bad' : 'text-warn'}`}>
                          {daysLabel(d.maxLate, d.dueToday > 0)}
                        </td>
                        <td className="py-3.5 pr-3.5"><RiskBadge level={d.risk_level} /></td>
                        <td className={`py-3.5 text-xs max-w-[260px] truncate ${c.tone}`} title={c.text}>{c.text}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {list.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 md:px-5 py-3.5 border-t border-line">
            <span className="text-[12.5px] text-faint">
              Showing {shown.length} of {list.length} · {fmtCurrency(listTotal)} across the whole list
            </span>
            {totalPages > 1 && <Pager page={page} totalPages={totalPages} setPage={setPage} compact />}
          </div>
        )}
      </Card>
    </div>
  )
}
