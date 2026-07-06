import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'

export async function getJournalEntries(userId, { limit = 60 } = {}) {
  return offlineDb.get(
    'journal_entries',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data
    }
  )
}

export async function getJournalEntryByDate(userId, date) {
  const results = await offlineDb.get(
    'journal_entries',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('entry_date', date)
        .maybeSingle()
      if (error) throw error
      return data ? [data] : []
    },
    (e) => e.entry_date === date
  )
  return results && results.length > 0 ? results[0] : null
}

export async function upsertJournalEntry(userId, entry) {
  console.log('[journal.js] upsertJournalEntry called', { userId, entry })
  const payload = { ...entry, user_id: userId, updated_at: new Date().toISOString() }

  return offlineDb.upsert(
    'journal_entries',
    userId,
    payload,
    ['user_id', 'entry_date'],
    async (item) => {
      const { data, error } = await supabase
        .from('journal_entries')
        .upsert(item, { onConflict: 'user_id,entry_date' })
        .select()
        .single()
      if (error) {
        console.log('[journal.js] upsert error details', error)
        throw error
      }
      return data
    }
  )
}

export async function deleteJournalEntry(id) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.delete(
    'journal_entries',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id)
      if (error) throw error
    }
  )
}
