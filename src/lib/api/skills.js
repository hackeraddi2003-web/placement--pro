import { supabase } from '../supabaseClient'

export const LANGUAGE_LIST = ['Java', 'SQL', 'JavaScript', 'HTML', 'CSS', 'Python']
export const SUBJECT_LIST = ['OOPs', 'DBMS', 'Operating System', 'Computer Networks']

// ---- Languages ----
export async function getLanguageProgress(userId) {
  const { data, error } = await supabase.from('language_progress').select('*').eq('user_id', userId)
  if (error) throw error
  return data
}

export async function ensureLanguagesSeeded(userId) {
  const existing = await getLanguageProgress(userId)
  const existingNames = new Set(existing.map((l) => l.language))
  const missing = LANGUAGE_LIST.filter((name) => !existingNames.has(name))
  if (missing.length === 0) return existing
  const { data, error } = await supabase
    .from('language_progress')
    .insert(missing.map((language) => ({ user_id: userId, language })))
    .select()
  if (error) throw error
  return [...existing, ...data]
}

export async function updateLanguageProgress(id, updates) {
  const { data, error } = await supabase
    .from('language_progress')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- Core Subjects ----
export async function getSubjectProgress(userId) {
  const { data, error } = await supabase.from('subject_progress').select('*').eq('user_id', userId)
  if (error) throw error
  return data
}

export async function ensureSubjectsSeeded(userId) {
  const existing = await getSubjectProgress(userId)
  const existingNames = new Set(existing.map((s) => s.subject))
  const missing = SUBJECT_LIST.filter((name) => !existingNames.has(name))
  if (missing.length === 0) return existing
  const { data, error } = await supabase
    .from('subject_progress')
    .insert(missing.map((subject) => ({ user_id: userId, subject })))
    .select()
  if (error) throw error
  return [...existing, ...data]
}

export async function updateSubjectProgress(id, updates) {
  const { data, error } = await supabase
    .from('subject_progress')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
