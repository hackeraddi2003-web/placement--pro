import { supabase } from '../supabaseClient'

export const INTERVIEW_CATEGORIES = ['OOPs', 'DBMS', 'SQL', 'OS', 'CN', 'HR']

export const DEFAULT_HR_QUESTIONS = [
  'Tell me about yourself',
  'What are your strengths?',
  'What are your weaknesses?',
  'Why should we hire you?',
  'Where do you see yourself in 5 years?',
]

export async function getInterviewQuestions(userId, category = null) {
  let query = supabase.from('interview_questions').select('*').eq('user_id', userId)
  if (category) query = query.eq('category', category)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addInterviewQuestion(userId, q) {
  const { data, error } = await supabase
    .from('interview_questions')
    .insert({ ...q, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInterviewQuestion(id, updates) {
  const { data, error } = await supabase
    .from('interview_questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteInterviewQuestion(id) {
  const { error } = await supabase.from('interview_questions').delete().eq('id', id)
  if (error) throw error
}
