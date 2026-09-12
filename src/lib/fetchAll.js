/* ============================================================
   fetchAll — pages past Supabase's 1,000-row API cap.

   WHY THIS EXISTS
   PostgREST (which powers the Supabase REST API) returns at most
   `max-rows` per request. On Supabase that default is 1,000.
   A plain `.select('*')` silently returns the first 1,000 rows
   and no error. With 2,507 invoices in the table, 1,507 of them
   were invisible to the entire app — pages, KPIs and exports.

   USAGE
   Pass a FACTORY that builds a fresh query each call. Supabase
   query builders are single-use (they resolve like a promise),
   so the same builder cannot be re-ranged. This is why the
   argument is a function and not a query object.

     const rows = await fetchAll(() =>
       supabase.from('invoice_details').select('*').order('invoice_date')
     )

   Always `.order()` inside the factory. Without a stable sort,
   Postgres may return rows in a different order per page and
   you will get duplicates and gaps across page boundaries.
   ============================================================ */

const PAGE_SIZE = 1000
const HARD_CAP  = 200000   // refuse to spin forever on a bad query

export async function fetchAll(queryFactory, pageSize = PAGE_SIZE) {
  const rows = []
  let from = 0

  for (;;) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1)
    if (error) throw error

    const batch = data ?? []
    rows.push(...batch)

    // short page => that was the last one
    if (batch.length < pageSize) break

    from += pageSize

    if (rows.length >= HARD_CAP) {
      console.warn(`[fetchAll] stopped at ${HARD_CAP} rows — check your query.`)
      break
    }
  }

  return rows
}

/* Count rows without transferring them. Useful as a tripwire:
   compare against the array length you rendered. */
export async function countRows(queryFactory) {
  const { count, error } = await queryFactory().select('*', {
    count: 'exact', head: true,
  })
  if (error) throw error
  return count ?? 0
}
