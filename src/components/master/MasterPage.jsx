import { useState } from 'react'
import { useMasterData } from '../../hooks/useMasterData'
import { useAuth } from '../../hooks/useAuth'
import { Plus, X, Loader2, Pencil } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

/* ── Stockist Modal (Add & Edit) ── */
function StockistModal({ stockist, companies, allPsrs, locations, onSave, onClose }) {
  const editing = !!stockist
  const [f, setF] = useState({
    name:        stockist?.name              ?? '',
    town:        stockist?.town              ?? '',
    mobile:      stockist?.mobile            ?? '',
    company_id:  stockist?.company_id        ?? '',
    psr_id:      stockist?.psr_id            ?? '',
    location_id: stockist?.location_id       ?? '',
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
              {allPsrs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.locations?.name})</option>)}
            </select></div>
          <div><label className="label">Location *</label>
            <select className="input" value={f.location_id} onChange={e => s('location_id')(e.target.value)}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
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
function PsrModal({ psr, companies, locations, onSave, onClose }) {
  const editing = !!psr
  const [f, setF] = useState({
    name:        psr?.name        ?? '',
    mobile:      psr?.mobile      ?? '',
    company_id:  psr?.company_id  ?? '',
    location_id: psr?.location_id ?? '',
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
            <select className="input" value={f.location_id} onChange={e => s('location_id')(e.target.value)}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
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

/* ── Main Page ── */
export default function MasterPage() {
  const { isAdmin } = useAuth()
  const { companies, locations, allPsrs, allStockists, loading, addStockist, addPsr, refetch } = useMasterData()
  const [stockistModal, setStockistModal] = useState(null)
  const [psrModal,      setPsrModal]      = useState(null)

  if (!isAdmin) return <Navigate to="/" replace />

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  async function saveStockist(payload, id) {
    if (id) {
      const { error } = await supabase.from('stockists').update(payload).eq('id', id)
      if (error) throw error
      await refetch()
    } else {
      await addStockist(payload)
    }
  }

  async function savePsr(payload, id) {
    if (id) {
      const { error } = await supabase.from('psrs').update(payload).eq('id', id)
      if (error) throw error
      await refetch()
    } else {
      await addPsr(payload)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Master Data</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage stockists, PSRs, companies and locations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Stockists ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Stockists <span className="text-gray-400 font-normal ml-1">({allStockists.length})</span>
            </h2>
            <button onClick={() => setStockistModal({})} className="btn-primary text-xs">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full">
              <thead>
                <tr>{['Name','Town','Company','PSR','Mobile','Credit',''].map(h =>
                  <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {allStockists.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="td font-medium text-sm">{s.name}</td>
                    <td className="td text-gray-500 text-xs">{s.town}</td>
                    <td className="td text-gray-500 text-xs">{s.companies?.name}</td>
                    <td className="td text-gray-500 text-xs">{s.psrs?.name}</td>
                    <td className="td font-mono text-xs text-gray-400">{s.mobile ?? '—'}</td>
                    <td className="td text-gray-500 text-xs">{s.credit_days}d</td>
                    <td className="td">
                      <button onClick={() => setStockistModal(s)}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {allStockists.length === 0 && (
                  <tr><td colSpan={7} className="td text-center text-gray-400 py-8">No stockists yet</td></tr>
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
            <button onClick={() => setPsrModal({})} className="btn-primary text-xs">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full">
              <thead>
                <tr>{['Name','Location','Company','Mobile',''].map(h =>
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
                    <td className="td">
                      <button onClick={() => setPsrModal(p)}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {allPsrs.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-gray-400 py-8">No PSRs yet</td></tr>
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
      </div>

      {stockistModal !== null && (
        <StockistModal
          stockist={stockistModal?.id ? stockistModal : null}
          companies={companies} allPsrs={allPsrs} locations={locations}
          onSave={saveStockist} onClose={() => setStockistModal(null)}
        />
      )}
      {psrModal !== null && (
        <PsrModal
          psr={psrModal?.id ? psrModal : null}
          companies={companies} locations={locations}
          onSave={savePsr} onClose={() => setPsrModal(null)}
        />
      )}
    </div>
  )
}
