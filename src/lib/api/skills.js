import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'

export const LANGUAGE_LIST = ['Java', 'SQL', 'JavaScript', 'HTML', 'CSS', 'Python']
export const SUBJECT_LIST = ['OOPs', 'DBMS', 'Operating System', 'Computer Networks']

// ---- Languages ----
export async function getLanguageProgress(userId) {
  return offlineDb.get(
    'language_progress',
    userId,
    async () => {
      const { data, error } = await supabase.from('language_progress').select('*').eq('user_id', userId)
      if (error) throw error
      return data
    }
  )
}

export async function ensureLanguagesSeeded(userId) {
  // Return existing languages only. Allow users to add their own languages.
  const existing = await getLanguageProgress(userId)
  return existing
}

export async function updateLanguageProgress(userId, id, updates) {
  return offlineDb.save(
    'language_progress',
    userId,
    { id, ...updates },
    async (item) => {
      const { data, error } = await supabase
        .from('language_progress')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function createLanguageProgress(userId, language) {
  const item = {
    language,
    current_level: 'Beginner',
    topics_completed: [],
  }

  return offlineDb.save(
    'language_progress',
    userId,
    item,
    async (it) => {
      const payload = {
        user_id: userId,
        language: it.language,
        current_level: it.current_level,
        topics_completed: it.topics_completed,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('language_progress').insert(payload).select().single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteLanguageProgress(userId, id) {
  return offlineDb.delete(
    'language_progress',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('language_progress').delete().eq('id', id)
      if (error) throw error
    }
  )
}

// ---- Core Subjects ----
export async function getSubjectProgress(userId) {
  return offlineDb.get(
    'subject_progress',
    userId,
    async () => {
      const { data, error } = await supabase.from('subject_progress').select('*').eq('user_id', userId)
      if (error) throw error
      return data
    }
  )
}

export async function ensureSubjectsSeeded(userId) {
  // Return existing subjects only. User will add their own subjects.
  const existing = await getSubjectProgress(userId)
  return existing
}

export async function updateSubjectProgress(userId, id, updates) {
  return offlineDb.save(
    'subject_progress',
    userId,
    { id, ...updates },
    async (item) => {
      const { data, error } = await supabase
        .from('subject_progress')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function createSubjectProgress(userId, subject) {
  const item = {
    subject,
    progress_pct: 0,
    notes: '',
  }

  return offlineDb.save(
    'subject_progress',
    userId,
    item,
    async (it) => {
      const payload = {
        user_id: userId,
        subject: it.subject,
        progress_pct: it.progress_pct || 0,
        notes: it.notes || '',
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('subject_progress').insert(payload).select().single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteSubjectProgress(userId, id) {
  return offlineDb.delete(
    'subject_progress',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('subject_progress').delete().eq('id', id)
      if (error) throw error
    }
  )
}

