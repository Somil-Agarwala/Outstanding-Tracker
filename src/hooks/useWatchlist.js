import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useWatchlist() {
  const { profile, isAdmin } = useAuth()
  const [dealers,  setDealers]  = useState([])
  const [loading,  setLoading]  = useState(true)

  const fetch = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    let q = supabase
      .from('watchlist_summary')
      .select('*')
      .order('risk_score', { ascending: false })

    if (!isAdmin && profile.location_id) {
      q = q.eq('location_id', profile.location_id)
    }

    const { data } = await q
    setDealers(data ?? [])
    setLoading(false)
  }, [isAdmin, profile?.location_id, profile?.id])

  useEffect(() => { fetch() }, [fetch])

  async function toggleWatchlist(stockistId, add, reason = '') {
    const { error } = await supabase
      .from('stockists')
      .update({ watchlist: add, watchlist_reason: reason || null })
      .eq('id', stockistId)
    if (error) throw error

    await supabase.from('watchlist_log').insert({
      stockist_id: stockistId,
      action: add ? 'added' : 'removed',
      reason: reason || null,
      performed_by: profile?.id,
    })
    await fetch()
  }

  async function getDealerDetail(stockistId) {
    const [inv, ph, wl] = await Promise.all([
      supabase.from('invoice_details').select('*')
        .eq('stockist_id', stockistId).order('invoice_date', { ascending: false }),
      supabase.from('payment_history').select('*')
        .eq('stockist_id', stockistId).order('payment_date', { ascending: false }),
      supabase.from('watchlist_log').select('*')
        .eq('stockist_id', stockistId).order('created_at', { ascending: false }),
    ])
    return {
      invoices: inv.data ?? [],
      payments: ph.data ?? [],
      logs:     wl.data ?? [],
    }
  }

  return { dealers, loading, refetch: fetch, toggleWatchlist, getDealerDetail }
}
