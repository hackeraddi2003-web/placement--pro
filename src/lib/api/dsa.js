import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'

export const DSA_TOPIC_LIST = [
  'Arrays', 'Strings', 'HashMap', 'Two Pointers', 'Sliding Window',
  'Binary Search', 'Stack', 'Queue', 'Linked List', 'Trees',
  'Heap', 'Graph', 'Dynamic Programming',
]

export async function getDsaTopics(userId) {
  return offlineDb.get(
    'dsa_topics',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('dsa_topics')
        .select('*')
        .eq('user_id', userId)
      if (error) throw error
      return data
    }
  )
}

/** Ensures all 13 canonical topics exist for a user (called once after first login) */
export async function ensureDsaTopicsSeeded(userId) {
  const existing = await getDsaTopics(userId)
  const existingNames = new Set(existing.map((t) => t.topic_name))
  const missing = DSA_TOPIC_LIST.filter((name) => !existingNames.has(name))
  if (missing.length === 0) return existing

  const payloadList = missing.map((topic_name) => ({
    user_id: userId,
    topic_name,
    status: 'not_started',
    progress_pct: 0,
  }))

  if (offlineDb.isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('dsa_topics')
        .insert(payloadList, { onConflict: 'user_id,topic_name' })
        .select()
      if (error) throw error
      return [...existing, ...(data || [])]
    } catch (err) {
      console.warn(`[dsa.js] Supabase seeding failed, using fallback cache.`, err)
    }
  }

  const seededLocal = payloadList.map((item) => ({
    ...item,
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  return [...existing, ...seededLocal]
}

export async function updateDsaTopic(id, updates) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.save(
    'dsa_topics',
    userId,
    { id, ...updates },
    async (item) => {
      const { data, error } = await supabase
        .from('dsa_topics')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function getDsaProblems(userId, topicId = null) {
  return offlineDb.get(
    'dsa_problems',
    userId,
    async () => {
      let query = supabase.from('dsa_problems').select('*').eq('user_id', userId)
      if (topicId) query = query.eq('topic_id', topicId)
      const { data, error } = await query.order('solved_date', { ascending: false })
      if (error) throw error
      return data
    },
    (prob) => !topicId || prob.topic_id === topicId
  )
}

export async function addDsaProblem(userId, problem) {
  return offlineDb.save(
    'dsa_problems',
    userId,
    problem,
    async (item) => {
      // Strip client-only timestamps before inserting to tables that don't have them
      const insertPayload = { ...item, user_id: userId }
      delete insertPayload.created_at
      delete insertPayload.updated_at

      const { data, error } = await supabase
        .from('dsa_problems')
        .insert(insertPayload)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function updateDsaProblem(id, updates) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.save(
    'dsa_problems',
    userId,
    { id, ...updates },
    async (item) => {
      const { data, error } = await supabase
        .from('dsa_problems')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteDsaProblem(id) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.delete(
    'dsa_problems',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('dsa_problems').delete().eq('id', id)
      if (error) throw error
    }
  )
}
