import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cached, keyOf, invalidate } from '../lib/cache'

/* ============================================================
   useDashboard

   BEFORE: downloaded all 2,507 invoice rows (2.6 MB) and did the
   arithmetic in the browser.
   AFTER:  one RPC, 4.5 KB. Postgres does the aggregation.
   ~597x less data per dashboard load.

   RLS still applies — fn_dashboard is SECURITY INVOKER, so a
   location manager gets their location's numbers and nothing more.
   ============================================================ */

export function useDashboard({ ttl = 60_000 } = {}) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      if (force) invalidate('dashboard')
      const json = await cached(keyOf('dashboard'), async () => {
        const { data, error } = await supabase.rpc('fn_dashboard')
        if (error) throw error
        return data
      }, ttl)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [ttl])

  useEffect(() => { load() }, [load])

  return {
    data,
    kpi:           data?.kpi ?? {},
    byCompany:     data?.by_company     ?? [],
    byLocation:    data?.by_location    ?? [],
    overdueTop:    data?.overdue_top    ?? [],
    watchlistTop:  data?.watchlist_top  ?? [],
    watchlistCount:data?.watchlist_count ?? 0,
    loading,
    error,
    refetch: () => load(true),
  }
}
