import { Link } from 'react-router-dom'
import { useLedger } from '../hooks/useLedger'
import { useAuth } from '../hooks/useAuth'
import { fmtCurrency } from '../lib/utils'
import { BUCKETS } from '../lib/ledger'
import { initials } from './layout/Layout'
import {
  Card, Kpi, Bar, RiskBadge, PageHeader, PageLoading, PageError, EmptyState, TONE, pct, daysLabel,
} from './ui'

export const BUCKET_TONE = { current: 'good', d30: 'warn', d60: 'warn', d90: 'bad', d90p: 'bad' }

export const HEALTH_LABEL = {
  duplicates:     { label: 'Same invoice entered twice',     tone: 'bad' },
  overpaid:       { label: 'Dealer paid more than the bill', tone: 'bad' },
  invalidDates:   { label: 'Invalid dates',                  tone: 'warn' },
  missingPayDate: { label: 'Payment with no date',           tone: 'warn' },
}

function todayHeading() {
  const d = new Date()
  return `${d.toLocaleDateString('en-IN', { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'long' })}`
}

function DelayCell({ d }) {
  if (d.maxLate > 0) return <span className="text-[12.5px] font-semibold text-bad text-right">{d.maxLate}</span>
  return <span className="text-[12.5px] font-semibold text-warn text-right">{daysLabel(0, d.dueToday > 0)}</span>
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const { analysis, health, loading, error, refetch } = useLedger()

  if (loading) return <PageLoading label="Adding up what is owed…" />
  if (error)   return <PageError message={error} onRetry={refetch} />

  const { kpi, buckets, collections, lateDealers } = analysis
  const lateCount = lateDealers.length
  const top = collections.slice(0, 5)
  const atStakeAll = collections.reduce((s, d) => s + d.atStake, 0)
  const topShare = atStakeAll > 0 ? top.reduce((s, d) => s + d.atStake, 0) / atStakeAll : 0
  const maxBucket = Math.max(1, ...BUCKETS.map(b => buckets[b.key].amount))
  const issues = Object.values(health).filter(h => h?.key && h.count > 0).sort((a, b) => b.count - a.count).slice(0, 3)
  const dueNames = kpi.dueTodayDealers

  return (
    <>
      {/* ── Phone ───────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="bg-brand px-[18px] pt-5 pb-[22px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12.5px] text-brand-soft">{isAdmin ? 'All locations' : profile?.locations?.name}</div>
              <div className="text-xl font-bold text-white tracking-[-0.02em]">{profile?.full_name}</div>
            </div>
            <div className="w-[38px] h-[38px] rounded-full bg-white text-brand text-sm font-bold flex items-center justify-center" aria-hidden="true">
              {initials(profile?.full_name)}
            </div>
          </div>
          <div className="bg-white/10 rounded-[11px] px-4 py-[15px] mt-[18px]">
            <div className="text-xs font-semibold text-brand-soft">{isAdmin ? 'Overdue' : 'Location Overdue'}</div>
            <div className="font-mono text-[25px] font-semibold text-white mt-1.5">{fmtCurrency(kpi.overdue)}</div>
            <div className="text-[12.5px] text-brand-soft mt-1">{lateCount} dealers · {kpi.overdueCount} invoices past due</div>
          </div>
        </div>
        <div className="px-4 py-[18px] flex flex-col gap-3">
          <h2 className="m-0 text-[15px] font-bold text-ink">Priority Collections</h2>
          {collections.length === 0 && (
            <Card><EmptyState title="Nothing is late today" body="Every dealer is inside their credit period." /></Card>
          )}
          {collections.slice(0, 3).map(d => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-ink truncate">{d.name}</div>
                  <div className="text-xs text-faint mt-0.5">{d.town}</div>
                </div>
                <RiskBadge level={d.risk_level} />
              </div>
              <div className="flex items-baseline gap-2.5 mt-3">
                <span className="font-mono text-[21px] font-semibold text-ink">{fmtCurrency(d.atStake)}</span>
                <span className={`text-[12.5px] font-semibold ${d.maxLate > 0 ? 'text-bad' : 'text-warn'}`}>
                  {d.maxLate > 0 ? `${d.maxLate} days late` : 'due today'}
                </span>
              </div>
              <div className="flex gap-2.5 mt-3.5">
                {d.mobile
                  ? <a href={`tel:${d.mobile.replace(/[^\d+]/g, '')}`} className="flex-1 min-h-[46px] flex items-center justify-center text-sm font-semibold text-white bg-brand rounded-[10px] hover:text-white">Call</a>
                  : <span className="flex-1 min-h-[46px] flex items-center justify-center text-sm text-faint bg-surface rounded-[10px]">No number</span>}
                <Link to={`/dealers/${d.id}`} className="flex-1 min-h-[46px] flex items-center justify-center text-sm font-semibold text-muted bg-white border border-line-input rounded-[10px]">Details</Link>
              </div>
            </Card>
          ))}
          {collections.length > 3 && (
            <Link to="/collections" className="bg-white border border-dashed border-line-input rounded-xl p-[18px] text-center text-[13px] text-faint">
              {collections.length - 3} more dealers behind on payment ›
            </Link>
          )}
        </div>
      </div>

      {/* ── Desktop ─────────────────────────────────────────── */}
      <div className="hidden md:flex page gap-5">
        <PageHeader
          title={todayHeading()}
          sub={lateCount > 0
            ? `${lateCount} dealer${lateCount === 1 ? ' owes' : 's owe'} you money past its due date. That is the only number that needs you today.`
            : 'Nobody is past their due date. Nothing needs chasing today.'}
          action={<Link to="/collections" className="btn-primary min-h-[44px] px-5 text-sm">Open Collections ({collections.length})</Link>}
        />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
          <Kpi label="Total Outstanding" value={fmtCurrency(kpi.outstanding)} sub={`across ${kpi.openCount} open invoices`} />
          <Kpi label="Overdue" value={fmtCurrency(kpi.overdue)} tone="bad"
            sub={`${pct(kpi.outstanding ? kpi.overdue / kpi.outstanding : 0)} of everything owed`} />
          <Kpi label="Due Today" value={fmtCurrency(kpi.dueToday)} tone={dueNames.length ? 'warn' : 'neutral'}
            sub={dueNames.length
              ? `${dueNames.length} dealer${dueNames.length === 1 ? '' : 's'} · ${dueNames[0]}${dueNames.length > 1 ? ' and others' : ''}`
              : 'nothing falls due today'} />
          <Kpi label="Collected This Week" value={fmtCurrency(kpi.collectedWeek)} tone="good"
            sub={`across ${kpi.paymentsWeek} payment${kpi.paymentsWeek === 1 ? '' : 's'}`} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-[18px]">
          <Card className="px-6 py-[22px] flex flex-col min-w-0">
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <h2 className="h2">Priority Collections</h2>
                <p className="h2-sub">
                  {top.length
                    ? `They hold ${pct(topShare)} of all the late money.${topShare >= 0.5 && top.length === 5 ? ' Five calls, most of the problem.' : ''}`
                    : 'Nobody is late right now.'}
                </p>
              </div>
              <Link to="/collections" className="link-more">See all {collections.length} ›</Link>
            </div>

            {top.length === 0
              ? <EmptyState title="Nothing is late today" body="Every dealer is inside their credit period." linkTo="/ageing" linkLabel="Look at what is coming up" />
              : (
                <div role="table" aria-label="Priority collections">
                  <div role="row" className="grid grid-cols-[2.2fr_1.2fr_1fr_0.7fr_96px] gap-3.5 pt-3.5 pb-2 border-b border-line mt-3">
                    <span role="columnheader" className="col-head">Stockist</span>
                    <span role="columnheader" className="col-head">PSR</span>
                    <span role="columnheader" className="col-head text-right">Balance</span>
                    <span role="columnheader" className="col-head text-right">Delay</span>
                    <span role="columnheader" className="col-head">Risk</span>
                  </div>
                  {top.map(d => (
                    <Link role="row" key={d.id} to={`/dealers/${d.id}`}
                      className="grid grid-cols-[2.2fr_1.2fr_1fr_0.7fr_96px] gap-3.5 py-3.5 border-b border-line-soft items-center hover:bg-surface -mx-2 px-2 rounded">
                      <div role="cell" className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-ink truncate">{d.name}</div>
                        <div className="text-[11.5px] text-faint mt-0.5">{d.town}</div>
                      </div>
                      <span role="cell" className="text-[12.5px] text-muted truncate">{d.psr ?? '—'}</span>
                      <span role="cell" className="font-mono text-sm font-semibold text-ink text-right">{fmtCurrency(d.atStake)}</span>
                      <span role="cell" className="text-right"><DelayCell d={d} /></span>
                      <span role="cell"><RiskBadge level={d.risk_level} /></span>
                    </Link>
                  ))}
                </div>
              )}
            <p className="mt-3.5 text-xs text-faint leading-relaxed">
              &ldquo;Risk&rdquo; comes from how often this dealer has paid late before, and by how much. Click any row to open their full history.
            </p>
          </Card>

          <div className="flex flex-col gap-[18px] min-w-0">
            <Card className="px-6 py-[22px]">
              <div className="flex items-baseline justify-between">
                <h2 className="h2">Ageing Analysis</h2>
                <Link to="/ageing" className="link-more">Break it down ›</Link>
              </div>
              <div className="flex flex-col gap-[13px] mt-4">
                {BUCKETS.map(b => (
                  <div key={b.key}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[12.5px] text-ink">{b.label}</span>
                      <span className="font-mono text-[13px] font-semibold text-ink">{fmtCurrency(buckets[b.key].amount)}</span>
                    </div>
                    <Bar pct={buckets[b.key].amount / maxBucket} tone={BUCKET_TONE[b.key]} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="px-6 py-[22px] flex-1">
              <div className="flex items-baseline justify-between">
                <h2 className="h2">Data Health</h2>
                <Link to="/data-health" className="link-more">Open fix list ›</Link>
              </div>
              <p className="h2-sub mb-4">Entries that are making your numbers wrong.</p>
              {issues.length === 0
                ? <p className="text-[12.5px] text-good">No problems found. Your totals are clean.</p>
                : (
                  <div className="flex flex-col gap-[11px]">
                    {issues.map(h => {
                      const m = HEALTH_LABEL[h.key]
                      return (
                        <Link key={h.key} to={`/data-health#${h.key}`}
                          className={`flex items-center justify-between px-3.5 py-3 border rounded-[9px] ${TONE[m.tone].box}`}>
                          <span className={`text-[12.5px] ${TONE[m.tone].ink}`}>{m.label}</span>
                          <span className={`font-mono text-[13px] font-semibold ${TONE[m.tone].text}`}>{h.count}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
