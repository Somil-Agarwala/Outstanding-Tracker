import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { cached, keyOf, invalidate } from '../lib/cache'
import { analyse, dataHealth } from '../lib/ledger'
import { useAuth } from './useAuth'

const COLUMNS = [
  'id', 'invoice_number', 'invoice_date', 'invoice_received_date', 'due_date', 'credit_days',
  'invoice_amount', 'cn_dn_amount', 'net_outstanding',
  'pdc_cheque_number', 'pdc_date', 'pdc_amount',
  'payment_received', 'payment_date', 'balance',
  'calling_remarks_1', 'calling_remarks_2', 'last_called_date', 'updated_at',
  'company_id', 'company_name', 'stockist_id', 'stockist_name', 'town', 'stockist_mobile',
  'location_id', 'location_name', 'psr_id', 'psr_name',
  'risk_level', 'risk_score', 'watchlist',
].join(',')

/* One shared, cached read of every invoice the user may see. The
   invoice_details view does not apply RLS, so location managers are
   scoped here the same way useInvoices does it. */
export function useLedger({ ttl = 120_000 } = {}) {
  const { profile, isAdmin } = useAuth()
  const [rows,    setRows]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const scope = isAdmin ? 'all' : profile?.location_id ?? 'none'

  const load = useCallback(async (force = false) => {
    if (!profile) return
    setLoading(true)
    setError(null)
    try {
      if (force) invalidate('ledger')
      const data = await cached(keyOf('ledger', { scope }), () =>
        fetchAll(() => {
          let q = supabase.from('invoice_details').select(COLUMNS)
            .order('invoice_date', { ascending: false }).order('id')
          if (!isAdmin) q = q.eq('location_id', profile.location_id)
          return q
        }), ttl)
      setRows(data)
    } catch (e) {
      setError(e.message || 'Could not load invoices')
    } finally {
      setLoading(false)
    }
  }, [profile, isAdmin, scope, ttl])

  useEffect(() => { load() }, [load])

  const analysis = useMemo(() => (rows ? analyse(rows) : null), [rows])
  const health   = useMemo(() => (rows ? dataHealth(rows) : null), [rows])

  return { rows, analysis, health, loading: loading && !rows, refreshing: loading, error, refetch: () => load(true) }
}
