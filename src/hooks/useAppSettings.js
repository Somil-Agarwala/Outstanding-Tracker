import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/* App-wide switches kept in the app_settings table.
   manager_master_edit: location managers may add and edit stockists and
   PSRs in their own location. The database enforces it too (RLS), so this
   hook only decides what the screen shows. If the table is not set up yet,
   every switch reads as off. */
export function useAppSettings() {
  const { profile, isAdmin } = useAuth()
  const [managerEdit, setManagerEditState] = useState(false)
  const [ready,   setReady]   = useState(false)
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('app_settings')
      .select('value').eq('key', 'manager_master_edit').maybeSingle()
    if (error) {
      setMissing(/relation .* does not exist|schema cache|not find the table/i.test(error.message ?? ''))
      setManagerEditState(false)
    } else {
      setMissing(false)
      setManagerEditState(data?.value === true)
    }
    setReady(true)
  }, [profile])

  useEffect(() => { load() }, [load])

  async function setManagerEdit(on) {
    if (!isAdmin) throw new Error('Only an admin can change this')
    const { error } = await supabase.from('app_settings').upsert({
      key: 'manager_master_edit', value: !!on,
      updated_at: new Date().toISOString(), updated_by: profile?.id ?? null,
    }, { onConflict: 'key' })
    if (error) throw error
    setManagerEditState(!!on)
  }

  return { managerEdit, setManagerEdit, ready, missing, refetch: load }
}
