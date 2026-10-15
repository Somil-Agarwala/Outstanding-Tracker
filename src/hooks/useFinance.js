import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { invalidate } from '../lib/cache'
import { useAuth } from './useAuth'

/* Margins, loans and the payment log for the Party P&L.
   Margins and loans are admin-only in the database, so this does nothing
   for location managers. Pass stockistId to load one dealer's payments only. */
export function useFinance({ stockistId = null, withHistory = true } = {}) {
  const { isAdmin, profile } = useAuth()
  const [finance, setFinance] = useState([])
  const [loans,   setLoans]   = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    if (!profile || !isAdmin) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [f, l, h] = await Promise.all([
        fetchAll(() => supabase.from('company_finance').select('*').order('company_id')),
        fetchAll(() => supabase.from('loans').select('*').order('created_at').order('id')),
        withHistory
          ? fetchAll(() => {
              let q = supabase.from('payment_history')
                .select('id, invoice_id, stockist_id, amount, payment_date, is_estimate')
                .order('payment_date').order('id')
              if (stockistId) q = q.eq('stockist_id', stockistId)
              return q
            })
          : Promise.resolve([]),
      ])
      setFinance(f); setLoans(l); setHistory(h)
    } catch (e) {
      setError(/relation .* does not exist|schema cache/i.test(e.message ?? '')
        ? 'The P&L tables are not set up yet. Run supabase/2026-10-16_party_pnl.sql in the Supabase SQL Editor.'
        : e.message)
    } finally {
      setLoading(false)
    }
  }, [profile, isAdmin, stockistId, withHistory])

  useEffect(() => { load() }, [load])

  async function saveMargins(rows) {
    const payload = rows.map(r => ({
      company_id: r.company_id,
      margin_pct: Number(r.margin_pct) || 0,
      cost_to_serve_pct: Number(r.cost_to_serve_pct) || 0,
      updated_at: new Date().toISOString(),
      updated_by: profile?.id ?? null,
    }))
    const { error: e } = await supabase.from('company_finance').upsert(payload, { onConflict: 'company_id' })
    if (e) throw e
    invalidate('ledger')
    await load()
  }

  async function saveLoan(payload, id = null) {
    const row = { ...payload, updated_at: new Date().toISOString() }
    const { error: e } = id
      ? await supabase.from('loans').update(row).eq('id', id)
      : await supabase.from('loans').insert(row)
    if (e) throw e
    await load()
  }

  async function deleteLoan(id) {
    const { error: e } = await supabase.from('loans').delete().eq('id', id)
    if (e) throw e
    await load()
  }

  return { finance, loans, history, loading, error, refetch: load, saveMargins, saveLoan, deleteLoan }
}
