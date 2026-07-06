// src/lib/offlineDb.js
// Dual-write offline-first storage:
//   1. Every write → localStorage IMMEDIATELY (user always sees their data)
//   2. Every write → Supabase in background (sync when online)
//   3. Every read → Supabase first, then merge + cache; on failure use localStorage

import { supabase } from './supabaseClient'

const getCacheKey = (table, userId) => `placementos_v1_${table}_${userId || 'anon'}`

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    // Storage quota exceeded – silently ignore (images may be large)
    console.warn('[offlineDb] localStorage write failed (quota?)', e)
  }
}

export const offlineDb = {
  /**
   * Returns true when real Supabase credentials are present.
   */
  isSupabaseConfigured() {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    return !!(
      url && key &&
      url !== 'https://placeholder-project.supabase.co' &&
      key !== 'placeholder-anon-key'
    )
  },

  /**
   * READ: Try Supabase, update cache, return data.
   *       On any failure: return cached data.
   */
  async get(table, userId, queryFn, fallbackFilter = () => true) {
    const cacheKey = getCacheKey(table, userId)
    const hasRealUser = userId && userId !== 'anon'

    if (this.isSupabaseConfigured() && hasRealUser) {
      try {
        const data = await queryFn()
        if (data !== null && data !== undefined) {
          const list = Array.isArray(data) ? data : [data]
          writeCache(cacheKey, list)
          return list
        }
      } catch (err) {
        console.warn(`[offlineDb] Supabase GET failed for "${table}". Serving from localStorage.`, err?.message)
      }
    }

    return readCache(cacheKey).filter(fallbackFilter)
  },

  /**
   * WRITE (insert/update): Save to localStorage first, then sync to Supabase.
   */
  async save(table, userId, item, saveFn) {
    const cacheKey = getCacheKey(table, userId)
    const list = readCache(cacheKey)

    // Assign a local ID if new
    if (!item.id) {
      item.id = crypto.randomUUID
        ? crypto.randomUUID()
        : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }
    if (!item.created_at) item.created_at = new Date().toISOString()
    item.updated_at = new Date().toISOString()
    if (userId) item.user_id = userId

    // Immediately update localStorage for UI responsiveness.
    const idx = list.findIndex((x) => x.id === item.id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item }
    } else {
      list.unshift(item)
    }
    writeCache(cacheKey, list)

    const hasRealUser = userId && userId !== 'anon'
    if (!this.isSupabaseConfigured() || !hasRealUser || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return item
    }

    try {
      const result = await saveFn(item)
      if (!result) throw new Error(`Supabase SAVE returned no result for ${table}`)
      const updated = list.map((x) => (x.id === item.id ? result : x))
      writeCache(cacheKey, updated)
      return result
    } catch (err) {
      console.warn(`[offlineDb] Supabase SAVE failed for "${table}". Data kept in localStorage.`, err?.message)
      return item
    }
  },

  /**
   * DELETE: Remove from localStorage immediately, then sync to Supabase.
   */
  async delete(table, userId, itemId, deleteFn) {
    const cacheKey = getCacheKey(table, userId)
    const filtered = readCache(cacheKey).filter((x) => x.id !== itemId)
    writeCache(cacheKey, filtered)

    const hasRealUser = userId && userId !== 'anon'
    if (!itemId || !this.isSupabaseConfigured() || !hasRealUser || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return
    }

    try {
      await deleteFn()
    } catch (err) {
      console.warn(`[offlineDb] Supabase DELETE failed for "${table}". Removed locally only.`, err?.message)
    }
  },

  /**
   * UPSERT: For rows with composite conflict keys (e.g. user_id + entry_date).
   */
  async upsert(table, userId, item, conflictKeys = [], upsertFn) {
    const cacheKey = getCacheKey(table, userId)

    if (userId) item.user_id = userId
    item.updated_at = new Date().toISOString()
    if (!item.created_at) item.created_at = new Date().toISOString()

    // Ensure we always have a stable composite-id in local cache.
    // This is required because local UPSERT must replace the same cached row,
    // otherwise reloading/logging out can make stats/goals/heatmap appear to reset.
    if (conflictKeys && conflictKeys.length > 0) {
      const composite = conflictKeys.map((k) => String(item[k])).join('|')
      item.id = item.id || `local_upsert_${table}_${composite}`
    } else if (!item.id) {
      item.id = crypto.randomUUID
        ? crypto.randomUUID()
        : `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    const list = readCache(cacheKey)

    const idx = list.findIndex((x) => {
      if (conflictKeys && conflictKeys.length > 0) {
        return conflictKeys.every((k) => x[k] === item[k])
      }
      return x.id === item.id
    })

    const nextList = idx >= 0
      ? list.map((x) => (x.id === list[idx].id ? { ...x, ...item } : x))
      : [item, ...list]

    writeCache(cacheKey, nextList)

    const hasRealUser = userId && userId !== 'anon'
    if (!this.isSupabaseConfigured() || !hasRealUser || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return item
    }

    try {
      const result = await upsertFn(item)
      if (!result) throw new Error(`Supabase UPSERT returned no result for ${table}`)
      const r = Array.isArray(result) ? result[0] : result

      // Replace the cached row that matches the conflict keys.
      const replaced = nextList.map((x) => {
        if (conflictKeys && conflictKeys.length > 0) {
          return conflictKeys.every((k) => x[k] === r[k]) ? { ...x, ...r, id: x.id } : x
        }
        return x.id === item.id ? r : x
      })

      writeCache(cacheKey, replaced)
      return r
    } catch (err) {
      console.warn(`[offlineDb] Supabase UPSERT failed for "${table}". Saved locally.`, err?.message)
      return item
    }
  },

  /**
   * Clear all cached data for a given userId (call on logout).
   */
  clearUserCache(userId) {
    const tables = [
      'daily_tasks', 'goals', 'daily_task_stats', 'journal_entries',
      'english_logs', 'dsa_topics', 'dsa_problems', 'projects',
      'subject_progress', 'language_progress', 'interview_questions',
      'job_applications', 'mentor_reviews', 'profiles',
    ]
    tables.forEach((t) => {
      try { localStorage.removeItem(getCacheKey(t, userId)) } catch { }
    })
  },
}
