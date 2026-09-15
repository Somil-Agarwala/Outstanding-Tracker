import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { cached, keyOf, invalidate } from '../lib/cache'

/* ============================================================
   useInvoicesPage — server-side pagination

   BEFORE: every visit downloaded all 2,507 rows (2.6 MB) and
   filtered, sorted and searched them in JavaScript.
   AFTER:  one page at a time (50 rows, ~44 KB). Filtering,
   searching, sorting and the summary totals all happen in
   Postgres, against indexes.

   The summary bar still reflects the WHOLE filtered set, not just
   the visible page — fn_invoices_page returns page rows and
   filtered totals together in one round trip.

   Full-table reads now happen only when the user clicks Export.
   ============================================================ */

const PAGE_SIZE = 50

export function useInvoicesPage(filters = {}, page = 1, pageSize = PAGE_SIZE) {
  const [rows,        setRows]        = useState([])
  const [totalCount,  setTotalCount]  = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [collected,   setCollected]   = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const runId = useRef(0)

  const args = {
    p_search:    filters.search    || null,
    p_status:    filters.status    || null,
    p_company:   filters.company   || null,
    p_psr:       filters.psr       || null,
    p_location:  filters.location  || null,
    p_page:      page,
    p_page_size: pageSize,
  }
  const cacheKey = keyOf('invoices', args)

  const load = useCallback(async () => {
    const myRun = ++runId.current
    setLoading(true)
    setError(null)
    try {
      const json = await cached(cacheKey, async () => {
        const { data, error } = await supabase.rpc('fn_invoices_page', args)
        if (error) throw error
        return data
      }, 30_000)

      if (myRun !== runId.current) return
      setRows(json?.rows ?? [])
      setTotalCount(json?.total_count ?? 0)
      setOutstanding(Number(json?.outstanding ?? 0))
      setCollected(Number(json?.collected ?? 0))
    } catch (e) {
      if (myRun === runId.current) setError(e.message)
    } finally {
      if (myRun === runId.current) setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  useEffect(() => { load() }, [load])

  /* Full filtered set — ONLY for Excel export. Paginated under the
     hood so it is never capped at 1,000 rows. */
  async function fetchAllForExport() {
    const chunk = 1000
    const out = []
    for (let p = 1; ; p++) {
      const { data, error } = await supabase.rpc('fn_invoices_page', {
        ...args, p_page: p, p_page_size: chunk,
      })
      if (error) throw error
      const batch = data?.rows ?? []
      out.push(...batch)
      if (batch.length < chunk) break
      if (out.length > 100000) break
    }
    return out
  }

  async function saveInvoice(payload, id = null, enteredBy = null) {
    if (id) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('invoices')
        .insert({ ...payload, entered_by: enteredBy })
      if (error) throw error
    }
    invalidate('invoices')
    invalidate('dashboard')
    await load()
  }

  async function deleteInvoice(id) {
    const { data, error } = await supabase.from('invoices')
      .delete().eq('id', id).select('id')
    if (error) throw error
    // RLS denials come back as a successful zero-row delete
    if (!data || data.length === 0) {
      throw new Error('Delete was blocked — you may not have permission for this location.')
    }
    invalidate('invoices')
    invalidate('dashboard')
    await load()
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return {
    rows, totalCount, outstanding, collected,
    loading, error, totalPages, pageSize,
    refetch: load, fetchAllForExport, saveInvoice, deleteInvoice,
  }
}

export { PAGE_SIZE }
