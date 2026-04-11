import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useMasterData() {
  const { profile, isAdmin } = useAuth()
  const [companies,  setCompanies]  = useState([])
  const [locations,  setLocations]  = useState([])
  const [psrs,       setPsrs]       = useState([])
  const [stockists,  setStockists]  = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchAll()
  }, [profile])

  async function fetchAll() {
    setLoading(true)
    const [c, l, p, s] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('psrs').select('id, name, mobile, location_id, company_id, locations(name), companies(name)').order('name'),
      supabase.from('stockists').select('id, name, town, mobile, credit_days, location_id, company_id, psr_id, locations(name), companies(name), psrs(name)').order('name'),
    ])
    setCompanies(c.data ?? [])
    setLocations(l.data ?? [])
    setPsrs(p.data ?? [])
    setStockists(s.data ?? [])
    setLoading(false)
  }

  // non-admins only see their location
  const myStockists = isAdmin ? stockists : stockists.filter(s => s.location_id === profile?.location_id)
  const myPsrs      = isAdmin ? psrs      : psrs.filter(p => p.location_id === profile?.location_id)

  async function addStockist(payload) {
    const { error } = await supabase.from('stockists').insert(payload)
    if (error) throw error
    await fetchAll()
  }

  async function addPsr(payload) {
    const { error } = await supabase.from('psrs').insert(payload)
    if (error) throw error
    await fetchAll()
  }

  return {
    companies, locations,
    psrs: myPsrs, allPsrs: psrs,
    stockists: myStockists, allStockists: stockists,
    loading, refetch: fetchAll, addStockist, addPsr,
  }
}
