/* ============================================================
   cache.js — request dedupe + short-lived result cache

   WHY
   Dashboard, Invoices and Reports each mounted their own copy of
   useInvoices(). Navigating Dashboard -> Invoices -> Dashboard
   issued three identical full-table downloads. Nothing was shared
   and nothing was remembered.

   WHAT THIS DOES
   1. Dedupe — two components asking for the same key at the same
      moment share one network request.
   2. TTL cache — a repeat ask within `ttl` is served from memory,
      so going back to a page you just left costs nothing.
   3. Invalidation — after a write, drop the affected keys so the
      next read is fresh.

   This is the same idea as React Query / SWR, in ~70 lines and
   with no new dependency. If the app grows, swap it for
   @tanstack/react-query — the hook signatures below won't change.
   ============================================================ */

const store   = new Map()   // key -> { value, expires }
const inFlight = new Map()  // key -> Promise

export const DEFAULT_TTL = 60_000   // 60s

export async function cached(key, loader, ttl = DEFAULT_TTL) {
  const now = Date.now()

  const hit = store.get(key)
  if (hit && hit.expires > now) return hit.value

  // someone else is already fetching this exact key — join them
  const pending = inFlight.get(key)
  if (pending) return pending

  const p = (async () => {
    try {
      const value = await loader()
      store.set(key, { value, expires: Date.now() + ttl })
      return value
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, p)
  return p
}

/* Drop cache entries whose key starts with `prefix`.
   invalidate('invoices') after saving an invoice. */
export function invalidate(prefix = '') {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

export function clearCache() {
  store.clear()
  inFlight.clear()
}

/* Stable cache key from an object — order-independent. */
export function keyOf(name, params = {}) {
  const parts = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k] ?? ''}`)
    .join('&')
  return `${name}?${parts}`
}
