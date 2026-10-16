import { useState } from 'react'
import { useMasterData } from '../../hooks/useMasterData'
import { useAuth } from '../../hooks/useAuth'
import { Plus, X, Loader2, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { invalidate } from '../../lib/cache'
import FinanceSection from './FinanceSection'
import { useAppSettings } from '../../hooks/useAppSettings'

/* ── Stockist Modal (Add & Edit) ── */
function StockistModal({ stockist, companies, allPsrs, locations, lockLocation = null, onSave, onClose }) {
  const editing = !!stockist
  const [f, setF] = useState({
    name:        stockist?.name              ?? '',
    town:        stockist?.town              ?? '',
    mobile:      stockist?.mobile            ?? '',
    company_id:  stockist?.company_id        ?? '',
    psr_id:      stockist?.psr_id            ?? '',
    location_id: stockist?.location_id       ?? lockLocation ?? '',
    credit_days: String(stockist?.credit_days ?? 30),
  })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const s = k => v => setF(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!f.name || !f.town || !f.company_id || !f.psr_id || !f.location_id) {
      setErr('All fields marked * are required'); return
    }
    setBusy(true)
    try {
      await onSave({
        name: f.name.trim(), town: f.town.trim(), mobile: f.mobile || null,
        company_id: f.company_id, psr_id: f.psr_id, location_id: f.location_id,
        credit_days: Number(f.credit_days) || 30,
      }, stockist?.id ?? null)
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-semibold">{editing ? 'Edit Stockist' : 'Add Stockist'}</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Name *</label>
            <input className="input" value={f.name} onChange={e => s('name')(e.target.value)} placeholder="Stockist / dealer name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Town *</label>
              <input className="input" value={f.town} onChange={e => s('town')(e.target.value)} placeholder="City / town" /></div>
            <div><label className="label">Mobile</label>
              <input className="input" value={f.mobile} onChange={e => s('mobile')(e.target.value)} placeholder="10-digit number" /></div>
          </div>
          <div><label className="label">Company *</label>
            <select className="input" value={f.company_id} onChange={e => s('company_id')(e.target.value)}>
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">PSR *</label>
            <select className="input" value={f.psr_id} onChange={e => s('psr_id')(e.target.value)}>
              <option value="">Select PSR…</option>
              {allPsrs.filter(p => !lockLocation || p.location_id === lockLocation)
                .map(p => <option key={p.id} value={p.id}>{p.name} ({p.locations?.name})</option>)}
            </select></div>
          <div><label className="label">Location *</label>
            <select className="input" value={f.location_id} disabled={!!lockLocation}
              onChange={e => s('location_id')(e.target.value)}>
              <option value="">Select location…</option>
              {locations.filter(l => !lockLocation || l.id === lockLocation)
                .map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div><label className="label">Credit Days *</label>
            <input type="number" min="1" className="input" value={f.credit_days}
              onChange={e => s('credit_days')(e.target.value)} /></div>
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">
              {busy && <Loader2 size={13} className="animate-spin" />} {editing ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── PSR Modal (Add & Edit) ── */
function PsrModal({ psr, companies, locations, lockLocation = null, onSave, onClose }) {
  const editing = !!psr
  const [f, setF] = useState({
    name:        psr?.name        ?? '',
    mobile:      psr?.mobile      ?? '',
    company_id:  psr?.company_id  ?? '',
    location_id: psr?.location_id ?? lockLocation ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const s = k => v => setF(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!f.name || !f.company_id || !f.location_id) {
      setErr('Name, company and location are required'); return
    }
    setBusy(true)
    try {
      await onSave({
        name: f.name.trim(), mobile: f.mobile || null,
        company_id: f.company_id, location_id: f.location_id,
      }, psr?.id ?? null)
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-semibold">{editing ? 'Edit PSR' : 'Add PSR / Agent'}</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Full Name *</label>
            <input className="input" value={f.name} onChange={e => s('name')(e.target.value)} placeholder="PSR full name" /></div>
          <div><label className="label">Mobile</label>
            <input className="input" value={f.mobile} onChange={e => s('mobile')(e.target.value)} placeholder="10-digit number" /></div>
          <div><label className="label">Company *</label>
            <select className="input" value={f.company_id} onChange={e => s('company_id')(e.target.value)}>
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Location *</label>
            <select className="input" value={f.location_id} disabled={!!lockLocation}
              onChange={e => s('location_id')(e.target.value)}>
              <option value="">Select location…</option>
              {locations.filter(l => !lockLocation || l.id === lockLocation)
                .map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">
              {busy && <Loader2 size={13} className="animate-spin" />} {editing ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Admin switch: let location managers edit ── */
function ManagerEditSwitch({ on, missing, onChange }) {
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  async function toggle() {
    setBusy(true); setErr('')
    try { await onChange(!on) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-700">Location managers can edit Master Data</div>
        <div className="text-xs text-faint mt-0.5">
          {missing
            ? 'Not set up yet: run supabase/2026-10-16_manager_master_edit.sql in Supabase.'
            : on
              ? 'On. Ashwani and Nitesh can add and edit stockists and PSRs in their own location. They cannot delete, or touch margins and loans.'
              : 'Off. Location managers can only view Master Data.'}
        </div>
        {err && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Let location managers edit Master Data"
        disabled={busy || missing} onClick={toggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-brand' : 'bg-gray-300'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

/* RLS refusals come back as an error on insert, but as zero rows on update. */
function friendly(e) {
  const msg = e?.message ?? String(e)
  return /row-level security|permission denied/i.test(msg)
    ? 'Not saved. Editing may have been turned off by an admin, or this is outside your location.'
    : msg
}

/* ── Main Page ── */
export default function MasterPage() {
  const { isAdmin, profile } = useAuth()
  const { companies, locations, allPsrs, allStockists, loading, addStockist, addPsr, refetch } = useMasterData()
  const { managerEdit, setManagerEdit, missing, refetch: refetchSettings } = useAppSettings()

  /* Admins always edit. Location managers edit their own location only
     while an admin has the switch on; the database enforces the same rule. */
  const isManager = profile?.role === 'location_manager' && !!profile?.location_id
  const canEdit = isAdmin || (isManager && managerEdit)
  const lockLocation = isAdmin ? null : profile?.location_id ?? null
  const [stockistModal, setStockistModal] = useState(null)
  const [psrModal,      setPsrModal]      = useState(null)
  const [stockistSearch, setStockistSearch] = useState('')

  const filteredStockists = allStockists.filter(s =>
    s.name.toLowerCase().includes(stockistSearch.toLowerCase())
  )

  /* Everyone sees Master Data. Location managers see their own location
     (RLS limits stockists and PSRs to it). Margins & Loans stay admin-only. */
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  /* Invoice screens keep a short-lived copy of every invoice, including each
     dealer's name, town, PSR and terms. Drop it after any master-data save so
     the change shows straight away. A change in credit days is carried onto the
     dealer's unpaid invoices by the trg_stockist_credit_days_sync database
     trigger, which recalculates their due dates. */
  async function saveRow(table, payload, id, add) {
    try {
      if (id) {
        const { data, error } = await supabase.from(table).update(payload).eq('id', id).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('row-level security')
        await refetch()
      } else {
        await add(payload)
      }
    } catch (e) {
      refetchSettings()
      throw new Error(friendly(e))
    }
    invalidate('ledger')
  }

  const saveStockist = (payload, id) => saveRow('stockists', payload, id, addStockist)
  const savePsr      = (payload, id) => saveRow('psrs', payload, id, addPsr)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Master Data</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isAdmin
            ? 'Manage stockists, PSRs, companies, locations, margins and loans'
            : canEdit
              ? 'Add and edit stockists and PSRs for your location.'
              : 'Stockists and PSRs for your location. Editing is turned off by the admin.'}
        </p>
      </div>

      {isAdmin && <ManagerEditSwitch on={managerEdit} missing={missing} onChange={setManagerEdit} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Stockists ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Stockists <span className="text-gray-400 font-normal ml-1">({filteredStockists.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search stockists..."
                value={stockistSearch}
                onChange={e => setStockistSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-44 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {canEdit && (
                <button onClick={() => setStockistModal({})} className="btn-primary text-xs">
                  <Plus size={12} /> Add
                </button>
              )}
            </div>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full">
              <thead>
                <tr>{['Name','Town','Company','PSR','Mobile','Credit', ...(canEdit ? [''] : [])].map(h =>
                  <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredStockists.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="td font-medium text-sm">{s.name}</td>
                    <td className="td text-gray-500 text-xs">{s.town}</td>
                    <td className="td text-gray-500 text-xs">{s.companies?.name}</td>
                    <td className="td text-gray-500 text-xs">{s.psrs?.name}</td>
                    <td className="td font-mono text-xs text-gray-400">{s.mobile ?? '—'}</td>
                    <td className="td text-gray-500 text-xs">{s.credit_days}d</td>
                    {canEdit && (
                      <td className="td">
                        <button onClick={() => setStockistModal(s)} aria-label={`Edit ${s.name}`}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors">
                          <Pencil size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredStockists.length === 0 && (
                  <tr><td colSpan={canEdit ? 7 : 6} className="td text-center text-gray-400 py-8">
                    {stockistSearch ? 'No stockists match your search' : 'No stockists yet'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── PSRs ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              PSRs / Agents <span className="text-gray-400 font-normal ml-1">({allPsrs.length})</span>
            </h2>
            {canEdit && (
              <button onClick={() => setPsrModal({})} className="btn-primary text-xs">
                <Plus size={12} /> Add
              </button>
            )}
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full">
              <thead>
                <tr>{['Name','Location','Company','Mobile', ...(canEdit ? [''] : [])].map(h =>
                  <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {allPsrs.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="td font-medium text-sm">{p.name}</td>
                    <td className="td text-gray-500 text-xs">{p.locations?.name}</td>
                    <td className="td text-gray-500 text-xs">{p.companies?.name}</td>
                    <td className="td font-mono text-xs text-gray-400">{p.mobile ?? '—'}</td>
                    {canEdit && (
                      <td className="td">
                        <button onClick={() => setPsrModal(p)} aria-label={`Edit ${p.name}`}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors">
                          <Pencil size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {allPsrs.length === 0 && (
                  <tr><td colSpan={canEdit ? 5 : 4} className="td text-center text-gray-400 py-8">No PSRs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Companies ── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Companies <span className="text-gray-400 font-normal">({companies.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {companies.map(c => <span key={c.id} className="badge badge-indigo">{c.name}</span>)}
          </div>
        </div>

        {/* ── Locations ── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Locations <span className="text-gray-400 font-normal">({locations.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {locations.map(l => <span key={l.id} className="badge badge-gray">{l.name}</span>)}
          </div>
        </div>

        {/* ── Margins & Loans (Party P&L) — admins only ── */}
        {isAdmin && <FinanceSection companies={companies} />}
      </div>

      {canEdit && stockistModal !== null && (
        <StockistModal
          stockist={stockistModal?.id ? stockistModal : null}
          companies={companies} allPsrs={allPsrs} locations={locations} lockLocation={lockLocation}
          onSave={saveStockist} onClose={() => setStockistModal(null)}
        />
      )}
      {canEdit && psrModal !== null && (
        <PsrModal
          psr={psrModal?.id ? psrModal : null}
          companies={companies} locations={locations} lockLocation={lockLocation}
          onSave={savePsr} onClose={() => setPsrModal(null)}
        />
      )}
    </div>
  )
}
