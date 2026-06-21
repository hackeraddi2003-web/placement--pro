import { supabase } from '../supabaseClient'

export const DSA_TOPIC_LIST = [
  'Arrays', 'Strings', 'HashMap', 'Two Pointers', 'Sliding Window',
  'Binary Search', 'Stack', 'Queue', 'Linked List', 'Trees',
  'Heap', 'Graph', 'Dynamic Programming',
]

export async function getDsaTopics(userId) {
  const { data, error } = await supabase
    .from('dsa_topics')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

/** Ensures all 13 canonical topics exist for a user (called once after first login) */
export async function ensureDsaTopicsSeeded(userId) {
  const existing = await getDsaTopics(userId)
  const existingNames = new Set(existing.map((t) => t.topic_name))
  const missing = DSA_TOPIC_LIST.filter((name) => !existingNames.has(name))
  if (missing.length === 0) return existing

  const { data, error } = await supabase
    .from('dsa_topics')
    .insert(missing.map((topic_name) => ({ user_id: userId, topic_name })))
    .select()
  if (error) throw error
  return [...existing, ...data]
}

export async function updateDsaTopic(id, updates) {
  const { data, error } = await supabase
    .from('dsa_topics')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDsaProblems(userId, topicId = null) {
  let query = supabase.from('dsa_problems').select('*').eq('user_id', userId)
  if (topicId) query = query.eq('topic_id', topicId)
  const { data, error } = await query.order('solved_date', { ascending: false })
  if (error) throw error
  return data
}

export async function addDsaProblem(userId, problem) {
  const { data, error } = await supabase
    .from('dsa_problems')
    .insert({ ...problem, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDsaProblem(id) {
  const { error } = await supabase.from('dsa_problems').delete().eq('id', id)
  if (error) throw error
}
