import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'

export const INTERVIEW_CATEGORIES = ['OOPs', 'DBMS', 'SQL', 'OS', 'CN', 'HR']

export const DEFAULT_HR_QUESTIONS = [
  'Tell me about yourself',
  'What are your strengths?',
  'What are your weaknesses?',
  'Why should we hire you?',
  'Where do you see yourself in 5 years?',
]

export async function getInterviewQuestions(userId, category = null) {
  return offlineDb.get(
    'interview_questions',
    userId,
    async () => {
      let query = supabase.from('interview_questions').select('*').eq('user_id', userId)
      if (category) query = query.eq('category', category)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    (q) => !category || q.category === category
  )
}

export async function addInterviewQuestion(userId, q) {
  return offlineDb.save(
    'interview_questions',
    userId,
    q,
    async (item) => {
      try {
        const { id, ...payload } = item
        const { data, error } = await supabase
          .from('interview_questions')
          .insert({ ...payload, user_id: userId })
          .select()
          .single()
        if (error) throw error
        return data
      } catch (err) {
        console.error('[interview.js] addInterviewQuestion failed', err)
        throw err
      }
    }
  )
}

export async function updateInterviewQuestion(userId, id, updates) {
  return offlineDb.save(
    'interview_questions',
    userId,
    { id, ...updates },
    async (item) => {
      try {
        const { data, error } = await supabase
          .from('interview_questions')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      } catch (err) {
        console.error('[interview.js] updateInterviewQuestion failed', err)
        throw err
      }
    }
  )
}

export async function deleteInterviewQuestion(userId, id) {
  return offlineDb.delete(
    'interview_questions',
    userId,
    id,
    async () => {
      try {
        const { error } = await supabase.from('interview_questions').delete().eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('[interview.js] deleteInterviewQuestion failed', err)
        throw err
      }
    }
  )
}

