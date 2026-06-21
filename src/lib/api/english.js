import { supabase } from '../supabaseClient'

export async function getEnglishLogs(userId, { limit = 30 } = {}) {
  const { data, error } = await supabase
    .from('english_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function addEnglishLog(userId, log) {
  const { data, error } = await supabase
    .from('english_logs')
    .insert({ ...log, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEnglishLog(id) {
  const { error } = await supabase.from('english_logs').delete().eq('id', id)
  if (error) throw error
}
