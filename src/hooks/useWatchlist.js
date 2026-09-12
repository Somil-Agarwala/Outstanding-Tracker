import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { useAuth } from './useAuth'

/* FIXED: paginated. Also paginates the dealer drawer's invoice
   and payment history, which had the same 1,000-row ceiling. */

export function useWatchlist() {
  const { profile, isAdmin } = useAuth()
  const [dealers, setDealers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAll(() => {
        let q = supabase
          .from('watchlist_summary')
          .select('*')
          .order('risk_score', { ascending: false })
          .order('id',         { ascending: true })
        if (!isAdmin && profile.location_id) q = q.eq('location_id', profile.location_id)
        return q
      })
      setDealers(rows)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, profile?.location_id, profile?.id])

  useEffect(() => { fetch() }, [fetch])

  async function toggleWatchlist(stockistId, add, reason = '') {
    // Manual entries carry the user's own reason. fn_recompute_risk
    // only auto-clears rows whose reason is exactly the auto marker,
    // so a manual flag is never undone by the scorer.
    const { error } = await supabase
      .from('stockists')
      .update({ watchlist: add, watchlist_reason: reason || null })
      .eq('id', stockistId)
    if (error) throw error

    await supabase.from('watchlist_log').insert({
      stockist_id:  stockistId,
      action:       add ? 'added' : 'removed',
      reason:       reason || null,
      performed_by: profile?.id,
    })
    await fetch()
  }

  async function getDealerDetail(stockistId) {
    const [invoices, payments, logs] = await Promise.all([
      fetchAll(() => supabase.from('invoice_details').select('*')
        .eq('stockist_id', stockistId)
        .order('invoice_date', { ascending: false })
        .order('id', { ascending: true })),
      fetchAll(() => supabase.from('payment_history').select('*')
        .eq('stockist_id', stockistId)
        .order('payment_date', { ascending: false })
        .order('id', { ascending: true })),
      fetchAll(() => supabase.from('watchlist_log').select('*')
        .eq('stockist_id', stockistId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })),
    ])
    return { invoices, payments, logs }
  }

  return { dealers, loading, error, refetch: fetch, toggleWatchlist, getDealerDetail }
}
