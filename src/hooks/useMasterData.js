import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { useAuth } from './useAuth'

/* FIXED: paginated. Stockists are under 1,000 today, but this
   table grows and the failure mode is silent — stockists simply
   stop appearing in the invoice dropdown with no error. */

export function useMasterData() {
  const { profile, isAdmin } = useAuth()
  const [companies, setCompanies] = useState([])
  const [locations, setLocations] = useState([])
  const [psrs,      setPsrs]      = useState([])
  const [stockists, setStockists] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, l, p, s] = await Promise.all([
        fetchAll(() => supabase.from('companies').select('*').order('name').order('id')),
        fetchAll(() => supabase.from('locations').select('*').order('name').order('id')),
        fetchAll(() => supabase.from('psrs')
          .select('id, name, mobile, location_id, company_id, locations(name), companies(name)')
          .order('name').order('id')),
        fetchAll(() => supabase.from('stockists')
          .select('id, name, town, mobile, credit_days, location_id, company_id, psr_id, ' +
                  'risk_score, risk_level, watchlist, locations(name), companies(name), psrs(name)')
          .order('name').order('id')),
      ])
      setCompanies(c); setLocations(l); setPsrs(p); setStockists(s)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (profile) fetchAllData() }, [profile, fetchAllData])

  const myStockists = isAdmin ? stockists : stockists.filter(s => s.location_id === profile?.location_id)
  const myPsrs      = isAdmin ? psrs      : psrs.filter(p => p.location_id === profile?.location_id)

  async function addStockist(payload) {
    const { error } = await supabase.from('stockists').insert(payload)
    if (error) throw error
    await fetchAllData()
  }

  async function addPsr(payload) {
    const { error } = await supabase.from('psrs').insert(payload)
    if (error) throw error
    await fetchAllData()
  }

  return {
    companies, locations,
    psrs: myPsrs, allPsrs: psrs,
    stockists: myStockists, allStockists: stockists,
    loading, error, refetch: fetchAllData, addStockist, addPsr,
  }
}
