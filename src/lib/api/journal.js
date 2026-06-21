import { supabase } from '../supabaseClient'

export async function getJournalEntries(userId, { limit = 60 } = {}) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getJournalEntryByDate(userId, date) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertJournalEntry(userId, entry) {
  console.log('[journal.js] upsertJournalEntry called', { userId, entry })

  const payload = { ...entry, user_id: userId, updated_at: new Date().toISOString() }

  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(payload, { onConflict: 'user_id,entry_date' })
    .select()
    .single()

  console.log('[journal.js] upsertJournalEntry supabase response', { data, error })

  if (error) {
    console.log('[journal.js] upsertJournalEntry throwing error', error)
    throw error
  }

  return data
}

export async function deleteJournalEntry(id) {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id)
  if (error) throw error
}
