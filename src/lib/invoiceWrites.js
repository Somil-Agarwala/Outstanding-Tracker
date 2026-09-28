import { supabase } from './supabase'
import { invalidate } from './cache'

function dropCaches() {
  invalidate('invoices')
  invalidate('dashboard')
  invalidate('ledger')
}

export async function saveInvoice(payload, id = null, enteredBy = null) {
  const { error } = id
    ? await supabase.from('invoices').update(payload).eq('id', id)
    : await supabase.from('invoices').insert({ ...payload, entered_by: enteredBy })
  if (error) throw error
  dropCaches()
}

export async function deleteInvoice(id) {
  const { data, error } = await supabase.from('invoices').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Delete was blocked — you may not have permission for this location.')
  }
  dropCaches()
}
