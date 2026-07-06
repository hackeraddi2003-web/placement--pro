import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'
import { sanitizeEnglishLogForStorage } from './englishPayload'

export async function getEnglishLogs(userId, { limit = 30 } = {}) {
  return offlineDb.get(
    'english_logs',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('english_logs')
        .select('*')
        .eq('user_id', userId)
        .order('log_date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data
    }
  )
}

export async function addEnglishLog(userId, log) {
  return offlineDb.save(
    'english_logs',
    userId,
    log,
    async (item) => {
      const { data, error } = await supabase
        .from('english_logs')
        .insert({ ...sanitizeEnglishLogForStorage(item), user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteEnglishLog(id) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.delete(
    'english_logs',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('english_logs').delete().eq('id', id)
      if (error) throw error
    }
  )
}

export async function updateEnglishLog(userId, log) {
  return offlineDb.save(
    'english_logs',
    userId,
    log,
    async (item) => {
      const { data, error } = await supabase
        .from('english_logs')
        .update(sanitizeEnglishLogForStorage(item))
        .eq('id', item.id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

