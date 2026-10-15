import { useState, useMemo, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Download, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLedger } from '../../hooks/useLedger'
import { useFinance } from '../../hooks/useFinance'
import { partyPnl, periodStart, PERIOD_LABELS, dayToISO, effectiveRate } from '../../lib/profit'
import { lakhs } from '../../lib/ledger'
import { fmtCurrency, fmtDate } from '../../lib/utils'
import { Card, Kpi, Badge, RiskBadge, PageHeader, PageLoading, PageError, NoResults, Pager, EmptyState } from '../ui'

const PAGE = 25

const SORTS = {
  worst:    { label: 'Biggest loss first',     fn: (a, b) => a.pnl - b.pnl },
  best:     { label: 'Biggest profit first',   fn: (a, b) => b.pnl - a.pnl },
  overdue:  { label: 'Most overdue interest',  fn: (a, b) => b.overdue - a.overdue },
  perday:   { label: 'Costing most per day',   fn: (a, b) => b.costPerDay - a.costPerDay },
  sales:    { label: 'Biggest sales',          fn: (a, b) => b.sales - a.sales },
}

const signed = n => (n < 0 ? '−' : '') + fmtCurrency(Math.abs(n))
const pctTxt = n => `${(n * 100).toFixed(1)}%`
const r2 = n => Math.round((Number(n) || 0) * 100) / 100

function exportExcel(res, label) {
  const wb = XLSX.utils.book_new()
  const sheet = (rows, name) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = rows[0].map((_, i) => ({ wch: i < 2 ? 26 : 15 }))
    if (rows.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: rows[0].length - 1, r: rows.length - 1 } }) }
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  sheet([
    ['Dealer', 'Town', 'Company', 'Location', 'PSR', 'Risk', 'Bills', 'Sales', 'Margin', 'Cost to serve',
     'Interest within terms', 'Interest after due date', 'Net P&L', 'Return %', 'Owed now', 'Overdue now', 'Interest per day now', 'Open bills already in loss'],
    ...[...res.dealers].sort((a, b) => a.pnl - b.pnl).map(d => [
      d.name, d.town, d.company, d.location, d.psr, d.risk_level, d.bills, r2(d.sales), r2(d.gross), r2(d.serve),
      r2(d.inTerms), r2(d.overdue), r2(d.pnl), r2(d.returnPct * 100), r2(d.owed), r2(d.overdueOwed), r2(d.costPerDay), d.lossBills,
    ]),
  ], 'Dealers')

  sheet([
    ['Company', 'Margin %', 'Cost to serve %', 'Bills', 'Sales', 'Margin', 'Cost to serve',
     'Interest within terms', 'Interest after due date', 'Net P&L', 'Return %', 'Owed now'],
    ...res.companies.map(c => [
      c.name, c.margin, c.cost, c.bills, r2(c.sales), r2(c.gross), r2(c.serve),
      r2(c.inTerms), r2(c.overdue), r2(c.pnl), r2(c.returnPct * 100), r2(c.owed),
    ]),
  ], 'Companies')

  sheet([
    ['Invoice No', 'Dealer', 'Company', 'Invoice date', 'Due date', 'Days late', 'Bill value', 'Owed now',
     'Net P&L so far', 'Interest per day', 'Turns loss-making on', 'Estimated dates'],
    ...res.openBills.map(b => [
      b.invoice_number, b.stockist_name, b.company_name, b.invoice_date, b.due_date, b.late, r2(b.sales), r2(b.owed),
      r2(b.pnl), r2(b.costPerDay), b.inLoss ? 'Already in loss' : (dayToISO(b.lossDay) ?? ''), b.estimate ? 'Yes' : '',
    ]),
  ], 'Open bills')

  sheet([
    ['Setting', 'Value'],
    ['Period', label],
    ['Interest rate used (% a year)', res.rate == null ? 'No loans entered' : r2(res.rate)],
    ['Interest is charged', 'From the invoice date until each rupee is received, on the unpaid amount only'],
    ['Within terms', 'Interest from the invoice date to the due date'],
    ['After due date', 'Interest from the due date until paid, or until today if still unpaid'],
    ['Companies without a margin', res.missingMargin.join(', ') || 'None'],
    ['Bills with estimated payment dates', res.totals.estimates],
    ['Generated', new Date().toLocaleString('en-IN')],
  ], 'How it is worked out')

  XLSX.writeFile(wb, `Party_PnL_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function ProfitPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const { rows, loading: lLoading, error: lError, refetch } = useLedger()
  const { finance, loans, history, loading: fLoading, error: fError, refetch: fRefetch } = useFinance()
  const [period, setPeriod] = useState('fy')
  const [loc, setLoc] = useState('')
  const [co, setCo] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('worst')
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [period, loc, co, q, sort])

  const scoped = useMemo(() => (rows ?? []).filter(r =>
    (!loc || r.location_name === loc) && (!co || r.company_name === co)), [rows, loc, co])

  const res = useMemo(() => partyPnl(scoped, history, finance, loans, { from: periodStart(period) }),
    [scoped, history, finance, loans, period])

  const locations = useMemo(() => [...new Set((rows ?? []).map(r => r.location_name).filter(Boolean))].sort(), [rows])
  const companies = useMemo(() => [...new Set((rows ?? []).map(r => r.company_name).filter(Boolean))].sort(), [rows])

  if (!isAdmin) return <Navigate to="/" replace />
  if ((lLoading && !rows) || fLoading) return <PageLoading label="Working out each dealer's P&L…" />
  if (lError || fError) return <PageError message={lError || fError} onRetry={() => { refetch(); fRefetch() }} />

  const { rate } = effectiveRate(loans)
  const t = res.totals
  const needle = q.trim().toLowerCase()
  const list = res.dealers
    .filter(d => !needle || d.name?.toLowerCase().includes(needle) || d.town?.toLowerCase().includes(needle))
    .sort(SORTS[sort].fn)
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice((page - 1) * PAGE, page * PAGE)
  const losing = res.dealers.filter(d => d.pnl < 0)

  return (
    <div className="page">
      <PageHeader
        title="Party P&L"
        sub="What each dealer earns you after the interest on the money they hold."
        action={<button type="button" className="btn-secondary" onClick={() => exportExcel(res, PERIOD_LABELS[period])} disabled={!res.dealers.length}>
          <Download size={14} /> Excel
        </button>} />

      {(rate == null || res.missingMargin.length > 0) && (
        <Card className="px-5 py-4 flex gap-3 items-start border-warn-line bg-warn-bg">
          <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-[13px] text-warn-ink leading-relaxed">
            {rate == null && <p>No loan is entered, so interest is counted as zero. Add your loans in Master Data.</p>}
            {res.missingMargin.length > 0 && <p>No margin set for {res.missingMargin.join(', ')}, so their bills show no margin and look like losses.</p>}
            <Link to="/master" className="link-more">Open Master Data ›</Link>
          </div>
        </Card>
      )}

      <Card className="flex items-center gap-2.5 px-4 md:px-5 py-3.5 flex-wrap">
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Period">
          {Object.entries(PERIOD_LABELS).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={period === k} className={period === k ? 'chip-on' : 'chip'} onClick={() => setPeriod(k)}>{label}</button>
          ))}
        </div>
        <span className="hidden sm:block w-px h-6 bg-line mx-1" aria-hidden="true" />
        <label className="sr-only-label" htmlFor="pl-loc">Location</label>
        <select id="pl-loc" className="input w-auto" value={loc} onChange={e => setLoc(e.target.value)}>
          <option value="">All locations</option>
          {locations.map(l => <option key={l}>{l}</option>)}
        </select>
        <label className="sr-only-label" htmlFor="pl-co">Company</label>
        <select id="pl-co" className="input w-auto" value={co} onChange={e => setCo(e.target.value)}>
          <option value="">All companies</option>
          {companies.map(c => <option key={c}>{c}</option>)}
        </select>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Kpi size={22} label="Sales" value={lakhs(t.sales)} sub={`${t.bills.toLocaleString('en-IN')} bills, by invoice date`} />
        <Kpi size={22} label="Margin after cost to serve" value={lakhs(t.gross - t.serve)}
          sub={t.sales ? `${pctTxt((t.gross - t.serve) / t.sales)} of sales` : '—'} />
        <Kpi size={22} label="Interest on dealer credit" value={lakhs(t.interest)} tone={t.overdue > t.inTerms ? 'bad' : 'warn'}
          sub={`${lakhs(t.overdue)} of it after the due date`} />
        <Kpi size={22} label="Net profit" value={signed(t.pnl)} tone={t.pnl < 0 ? 'bad' : 'good'}
          sub={t.sales ? `${pctTxt(t.returnPct)} of sales` : '—'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold text-muted">Money with dealers costs you</div>
          <div className="font-mono text-[20px] font-semibold text-ink mt-1">{fmtCurrency(t.costPerDay)} <span className="text-sm text-faint font-sans font-normal">a day</span></div>
          <div className="text-xs text-faint mt-0.5">on {lakhs(t.owed)} still unpaid{rate != null ? ` at ${rate.toFixed(2)}% a year` : ''}</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold text-muted">Open bills already losing money</div>
          <div className={`font-mono text-[20px] font-semibold mt-1 ${t.lossBills ? 'text-bad' : 'text-ink'}`}>{t.lossBills}</div>
          <div className="text-xs text-faint mt-0.5">interest has used up their whole margin</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold text-muted">Dealers in loss</div>
          <div className={`font-mono text-[20px] font-semibold mt-1 ${losing.length ? 'text-bad' : 'text-ink'}`}>{losing.length} <span className="text-sm text-faint font-sans font-normal">of {res.dealers.length}</span></div>
          <div className="text-xs text-faint mt-0.5">{losing.length ? `${signed(losing.reduce((s, d) => s + d.pnl, 0))} between them` : 'every dealer is earning you money'}</div>
        </Card>
      </div>

      <Card className="flex flex-col min-w-0">
        <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-line flex-wrap">
          <label htmlFor="plq" className="sr-only-label">Search dealers</label>
          <input id="plq" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search stockist or town…" className="input w-full sm:w-[240px]" />
          <label htmlFor="pls" className="sr-only-label">Sort</label>
          <select id="pls" className="input w-auto ml-auto" value={sort} onChange={e => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>

        {res.dealers.length === 0
          ? <EmptyState title="No bills in this period" body="Pick a longer period or clear the filters." />
          : list.length === 0 ? <NoResults query={q} onClear={() => setQ('')} />
          : (
            <div className="overflow-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="col-head py-2.5 px-4">Dealer</th>
                    <th className="col-head py-2.5 pr-3 text-right">Sales</th>
                    <th className="col-head py-2.5 pr-3 text-right">Net margin</th>
                    <th className="col-head py-2.5 pr-3 text-right">Interest · in terms</th>
                    <th className="col-head py-2.5 pr-3 text-right">Interest · overdue</th>
                    <th className="col-head py-2.5 pr-3 text-right">Net P&L</th>
                    <th className="col-head py-2.5 pr-3 text-right">Return</th>
                    <th className="col-head py-2.5 pr-3 text-right">Owed now</th>
                    <th className="col-head py-2.5 pr-4 text-right">Cost / day</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(d => (
                    <tr key={d.id} className="border-b border-line-soft cursor-pointer" onClick={() => navigate(`/dealers/${d.id}`)}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link to={`/dealers/${d.id}`} onClick={e => e.stopPropagation()} className="text-[13.5px] font-semibold text-ink hover:text-brand">{d.name}</Link>
                          {d.lossBills > 0 && <Badge tone="bad">{d.lossBills} in loss</Badge>}
                        </div>
                        <div className="text-[11.5px] text-faint mt-0.5 flex items-center gap-1.5">
                          {[d.town, d.company, d.location].filter(Boolean).join(' · ')}
                          {d.risk_level && d.risk_level !== 'low' && <RiskBadge level={d.risk_level} />}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono text-[12.5px] text-muted">{lakhs(d.sales)}</td>
                      <td className="py-3 pr-3 text-right font-mono text-[12.5px] text-muted">{fmtCurrency(d.gross - d.serve)}</td>
                      <td className="py-3 pr-3 text-right font-mono text-[12.5px] text-muted">{fmtCurrency(d.inTerms)}</td>
                      <td className={`py-3 pr-3 text-right font-mono text-[12.5px] ${d.overdue > 0 ? 'text-bad' : 'text-dim'}`}>{fmtCurrency(d.overdue)}</td>
                      <td className={`py-3 pr-3 text-right font-mono text-[13.5px] font-semibold ${d.pnl < 0 ? 'text-bad' : 'text-good'}`}>{signed(d.pnl)}</td>
                      <td className={`py-3 pr-3 text-right font-mono text-[12.5px] ${d.returnPct < 0 ? 'text-bad' : 'text-muted'}`}>{pctTxt(d.returnPct)}</td>
                      <td className="py-3 pr-3 text-right font-mono text-[12.5px] text-ink">{d.owed > 0 ? fmtCurrency(d.owed) : <span className="text-dim">—</span>}</td>
                      <td className="py-3 pr-4 text-right font-mono text-[12.5px] text-muted">{d.costPerDay >= 1 ? fmtCurrency(d.costPerDay) : <span className="text-dim">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        <div className="flex items-center justify-between gap-3 flex-wrap px-4 md:px-5 py-2.5 border-t border-line">
          <p className="text-xs text-faint">
            {list.length} dealer{list.length === 1 ? '' : 's'}
            {t.estimates > 0 && ` · ${t.estimates} bills use an estimated payment date (no date entered, or part-paid before the payment log started)`}
            {res.skipped > 0 && ` · ${res.skipped} bills skipped for an impossible invoice date — fix them in Data Health`}
          </p>
          <Pager page={page} totalPages={totalPages} setPage={setPage} compact />
        </div>
      </Card>

      {res.openBills.some(b => b.inLoss || b.lossDay != null) && (
        <Card className="px-4 md:px-6 py-5">
          <h2 className="h2">Open bills closest to turning loss-making</h2>
          <p className="h2-sub mb-3">Collect these first. Each day they stay unpaid, interest eats a little more of the margin.</p>
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="col-head pb-2.5 pr-3">Invoice No</th>
                  <th className="col-head pb-2.5 pr-3">Dealer</th>
                  <th className="col-head pb-2.5 pr-3">Invoice Date</th>
                  <th className="col-head pb-2.5 pr-3 text-right">Owed</th>
                  <th className="col-head pb-2.5 pr-3 text-right">P&L so far</th>
                  <th className="col-head pb-2.5">Loss from</th>
                </tr>
              </thead>
              <tbody>
                {res.openBills.slice(0, 15).map(b => (
                  <tr key={b.id} className="border-b border-line-soft">
                    <td className="py-2.5 pr-3 font-mono text-[12.5px] font-semibold text-brand">{b.invoice_number}</td>
                    <td className="py-2.5 pr-3 text-[12.5px]"><Link to={`/dealers/${b.stockist_id}`} className="text-ink hover:text-brand">{b.stockist_name}</Link></td>
                    <td className="py-2.5 pr-3 text-[12.5px] text-muted">{fmtDate(b.invoice_date)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-[12.5px]">{fmtCurrency(b.owed)}</td>
                    <td className={`py-2.5 pr-3 text-right font-mono text-[12.5px] ${b.pnl < 0 ? 'text-bad' : 'text-muted'}`}>{signed(b.pnl)}</td>
                    <td className="py-2.5">{b.inLoss ? <Badge tone="bad">Already losing</Badge> : b.lossDay != null ? <Badge tone="warn">{fmtDate(dayToISO(b.lossDay))}</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
