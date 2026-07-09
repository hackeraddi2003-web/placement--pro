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

// ---- LeetCode history / analytics helpers ----
// XP scales with difficulty so history reflects effort, not just count.
export const DIFFICULTY_XP = { Easy: 10, Medium: 15, Hard: 25 }

export function xpForDifficulty(difficulty) {
  return DIFFICULTY_XP[difficulty] ?? 15
}

/** Groups a flat problems list by solved_date -> array of problems. */
export function groupProblemsByDate(problems) {
  const map = {}
  for (const p of problems) {
    const key = p.solved_date
    if (!key) continue
    if (!map[key]) map[key] = []
    map[key].push(p)
  }
  return map
}

/**
 * Current + longest consecutive-day solving streak, computed purely from
 * distinct solved_date values already stored on dsa_problems. Never stored
 * separately, so it can never drift from the actual history.
 */
export function calculateSolvingStreak(problems, todayStr) {
  const dates = [...new Set(problems.map((p) => p.solved_date).filter(Boolean))].sort()
  if (dates.length === 0) return { current: 0, longest: 0 }

  const toUTC = (s) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }

  let longest = 1
  let run = 1
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((toUTC(dates[i]) - toUTC(dates[i - 1])) / 86400000)
    run = diff === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  // Current streak: walk backward from today (or yesterday, so a day still
  // in progress doesn't look "broken" before it's over).
  const dateSet = new Set(dates)
  let current = 0
  let cursor = toUTC(todayStr)
  if (!dateSet.has(todayStr)) {
    cursor -= 86400000 // allow "yesterday" as the streak anchor
  }
  while (true) {
    const key = new Date(cursor).toISOString().slice(0, 10)
    if (!dateSet.has(key)) break
    current += 1
    cursor -= 86400000
  }

  return { current, longest }
}
