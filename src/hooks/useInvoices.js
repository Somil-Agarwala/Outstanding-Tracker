import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useInvoices(filters = {}) {
  const { profile, isAdmin } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetch = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('invoice_details')
        .select('*')
        .order('invoice_date', { ascending: false })

      // location scope for non-admins
      if (!isAdmin && profile.location_id) {
        q = q.eq('location_id', profile.location_id)
      }

      // optional filter overrides
      if (filters.location_id) q = q.eq('location_id', filters.location_id)
      if (filters.company_id)  q = q.eq('company_id',  filters.company_id)
      if (filters.psr_id)      q = q.eq('psr_id',      filters.psr_id)
      if (filters.status)      q = q.eq('status',      filters.status)
      if (filters.search) {
        q = q.or(
          `invoice_number.ilike.%${filters.search}%,stockist_name.ilike.%${filters.search}%`
        )
      }

      const { data, error: err } = await q
      if (err) throw err
      setInvoices(data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, profile?.location_id, profile?.id,
      filters.location_id, filters.company_id, filters.psr_id,
      filters.status, filters.search])

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

  return { invoices, loading, error, refetch: fetch, saveInvoice }
}
