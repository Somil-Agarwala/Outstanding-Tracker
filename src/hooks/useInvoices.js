import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { useAuth } from './useAuth'

/* ============================================================
   useInvoices

   FIXED: the old version called .select('*') with no .range(),
   so Supabase returned only the newest 1,000 invoices. Ordered
   by invoice_date DESC, that meant the OLDEST invoices fell off
   the end — which is exactly where chronic late payers live.
   Every KPI, chart and export was computed on a partial set.

   Now pages through the full table and reports a truncation
   warning if the row count ever disagrees with what we loaded.
   ============================================================ */

export function useInvoices(filters = {}) {
  const { profile, isAdmin } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [total,    setTotal]    = useState(0)

  // guards against a slow earlier fetch overwriting a newer one
  const runId = useRef(0)

  const scope = useCallback((q) => {
    if (!isAdmin && profile?.location_id) q = q.eq('location_id', profile.location_id)
    if (filters.location_id) q = q.eq('location_id', filters.location_id)
    if (filters.company_id)  q = q.eq('company_id',  filters.company_id)
    if (filters.psr_id)      q = q.eq('psr_id',      filters.psr_id)
    if (filters.status)      q = q.eq('status',      filters.status)
    if (filters.search) {
      const s = String(filters.search).replace(/[%,()]/g, '')
      if (s) q = q.or(`invoice_number.ilike.%${s}%,stockist_name.ilike.%${s}%`)
    }
    return q
  }, [isAdmin, profile?.location_id, filters.location_id, filters.company_id,
      filters.psr_id, filters.status, filters.search])

  const fetch = useCallback(async () => {
    if (!profile) return
    const myRun = ++runId.current
    setLoading(true)
    setError(null)

    try {
      // exact count first — this is the tripwire
      const { count, error: cErr } = await scope(
        supabase.from('invoice_details').select('id', { count: 'exact', head: true })
      )
      if (cErr) throw cErr

      const rows = await fetchAll(() =>
        scope(
          supabase
            .from('invoice_details')
            .select('*')
            // stable, unique sort — required for correct paging
            .order('invoice_date', { ascending: false })
            .order('id',           { ascending: true })
        )
      )

      if (myRun !== runId.current) return   // a newer fetch already won

      if (count != null && rows.length !== count) {
        console.warn(
          `[useInvoices] loaded ${rows.length} of ${count} rows — data is incomplete.`
        )
      }

      setTotal(count ?? rows.length)
      setInvoices(rows)
    } catch (e) {
      if (myRun === runId.current) setError(e.message)
    } finally {
      if (myRun === runId.current) setLoading(false)
    }
  }, [profile, scope])

  useEffect(() => { fetch() }, [fetch])

  async function saveInvoice(payload, id = null) {
    if (id) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('invoices').insert({
        ...payload,
        entered_by: profile?.id,
      })
      if (error) throw error
    }
    await fetch()
  }

  async function deleteInvoice(id) {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  return {
    invoices,
    loading,
    error,
    total,                          // exact DB count, for "showing X of Y"
    truncated: invoices.length < total,
    refetch: fetch,
    saveInvoice,
    deleteInvoice,
  }
}
