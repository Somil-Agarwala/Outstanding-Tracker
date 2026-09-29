import { createClient } from '@supabase/supabase-js'

// Values pasted into a hosting dashboard often carry stray whitespace or quotes.
const clean = (v) => (v ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim()

// Also accept the names Vercel's Supabase integration creates (NEXT_PUBLIC_*)
// and the newer "publishable" key name. Only public prefixes are exposed to
// the browser (see envPrefix in vite.config.js), never service-role secrets.
const env = import.meta.env
const url = clean(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)
const key = clean(
  env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

function findConfigError() {
  if (!url && !key) return 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set in this build.'
  if (!url) return 'VITE_SUPABASE_URL is not set in this build.'
  if (!key) return 'VITE_SUPABASE_ANON_KEY is not set in this build.'
  try {
    const { protocol } = new URL(url)
    if (protocol !== 'https:' && protocol !== 'http:') throw new Error()
  } catch {
    return `VITE_SUPABASE_URL is not a valid URL (got "${url}"). It should look like https://your-project-id.supabase.co`
  }
  return null
}

let configError = findConfigError()
let client = null

if (!configError) {
  try {
    client = createClient(url, key)
  } catch (e) {
    configError = e.message
  }
}

export const supabaseConfigError = configError

// Never throw at module load: that kills the script before React mounts and
// leaves a blank page. main.jsx shows supabaseConfigError on screen instead.
export const supabase = client ?? createClient('https://placeholder.supabase.co', 'placeholder-anon-key')
