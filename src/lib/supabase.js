import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

// Fall back to placeholder values instead of throwing at module load time.
// Throwing here would crash the whole script before React ever mounts,
// leaving the page blank with no visible error. Missing/invalid config is
// instead surfaced as a real screen — see ConfigError in main.jsx.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key'
)
