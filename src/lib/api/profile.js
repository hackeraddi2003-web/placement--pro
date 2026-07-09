import { supabase, getAuthenticatedUserId, getLocalYYYYMMDD } from '../supabaseClient'
import { encryptApiKey, decryptApiKey } from '../cryptoHelper'
import { offlineDb } from '../offlineDb'

export async function getProfile(userId) {
  const cacheKey = `placementos_v1_profiles_${userId}`

  if (!userId) {
    throw new Error('Authenticated user is required to load profile.')
  }

  // Try Supabase first
  if (offlineDb.isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (!error && data) {
        const mergedData = { xp: 0, level: 1, hearts: 3, badges: [], ...data }
        localStorage.setItem(cacheKey, JSON.stringify([mergedData]))
        return mergedData
      }

      if (!error && !data) {
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({ id: userId, full_name: 'Placement Candidate', target_role: 'SDE / AI-ML Engineer' })
          .select()
          .single()
        if (createError) throw createError
        const mergedCreated = { xp: 0, level: 1, hearts: 3, badges: [], ...created }
        localStorage.setItem(cacheKey, JSON.stringify([mergedCreated]))
        return mergedCreated
      }
    } catch (err) {
      console.warn('[profile] Supabase getProfile failed, using cache.', err?.message)
    }
  }

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const list = JSON.parse(raw)
      if (list && list.length > 0) {
        const merged = { xp: 0, level: 1, hearts: 3, badges: [], ...list[0] }
        return merged
      }
    }
  } catch { }

  // No profile found anywhere — create a default
  const defaultProfile = {
    id: userId,
    full_name: 'Placement Candidate',
    target_role: 'SDE / AI-ML Engineer',
    target_companies: [],
    ai_provider: 'none',
    ai_api_key_encrypted: null,
    theme_preference: 'system',
    streak_count: 0,
    longest_streak: 0,
    last_active_date: null,
    xp: 0,
    level: 1,
    hearts: 3,
    badges: [],
    daily_quest_completed: false,
    last_quest_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  localStorage.setItem(cacheKey, JSON.stringify([defaultProfile]))
  return defaultProfile
}

export async function updateProfile(userId, updates) {
  const cacheKey = `placementos_v1_profiles_${userId}`

  // Merge into cache immediately
  try {
    const raw = localStorage.getItem(cacheKey)
    const list = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((p) => p.id === userId)
    const merged = {
      xp: 0, level: 1, hearts: 3, badges: [],
      ...(idx >= 0 ? list[idx] : { id: userId }),
      ...updates,
      updated_at: new Date().toISOString()
    }
    if (idx >= 0) list[idx] = merged; else list.push(merged)
    localStorage.setItem(cacheKey, JSON.stringify(list))
  } catch { }

  // Sync to Supabase - filter out custom columns not in the database schema
  const dbUpdates = { ...updates }
  delete dbUpdates.xp
  delete dbUpdates.level
  delete dbUpdates.hearts
  delete dbUpdates.badges
  delete dbUpdates.last_quest_date
  delete dbUpdates.daily_quest_completed

  if (offlineDb.isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...dbUpdates, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select()
        .single()
      if (!error && data) {
        const cacheRaw = localStorage.getItem(cacheKey)
        const cacheList = cacheRaw ? JSON.parse(cacheRaw) : []
        const cacheItem = cacheList.find((p) => p.id === userId) || {}
        const finalData = {
          xp: cacheItem.xp,
          level: cacheItem.level,
          hearts: cacheItem.hearts,
          badges: cacheItem.badges,
          last_quest_date: cacheItem.last_quest_date,
          daily_quest_completed: cacheItem.daily_quest_completed,
          ...data
        }
        localStorage.setItem(cacheKey, JSON.stringify([finalData]))
        return finalData
      }
    } catch (err) {
      console.warn('[profile] Supabase updateProfile failed, changes kept locally.', err?.message)
    }
  }

  // Return locally merged version
  try {
    const raw = localStorage.getItem(cacheKey)
    const list = raw ? JSON.parse(raw) : []
    return list.find((p) => p.id === userId) || null
  } catch {
    return null
  }
}

export async function saveAiSettings(userId, provider, apiKey) {
  const encrypted = apiKey ? await encryptApiKey(apiKey, userId) : null
  return updateProfile(userId, { ai_provider: provider, ai_api_key_encrypted: encrypted })
}

export async function saveThemePreference(userId, themePreference) {
  return updateProfile(userId, { theme_preference: themePreference })
}

export async function loadThemePreference(userId) {
  const profile = await getProfile(userId)
  return profile?.theme_preference || 'system'
}

export async function loadAiSettings(userId) {
  const profile = await getProfile(userId)
  const apiKey = profile?.ai_api_key_encrypted
    ? await decryptApiKey(profile.ai_api_key_encrypted, userId)
    : ''
  return { provider: profile?.ai_provider || 'none', apiKey }
}

/**
 * Calendar-date-safe day difference. Parses 'YYYY-MM-DD' strings as UTC
 * calendar dates so the result is never off-by-one due to local timezone
 * offset quirks in `new Date(dateString)` parsing.
 */
function daysBetweenDates(startStr, endStr) {
  const [y1, m1, d1] = startStr.split('-').map(Number)
  const [y2, m2, d2] = endStr.split('-').map(Number)
  const start = Date.UTC(y1, m1 - 1, d1)
  const end = Date.UTC(y2, m2 - 1, d2)
  return Math.round((end - start) / 86400000)
}

const DAILY_LOGIN_XP = 5

/**
 * Updates streak based on last_active_date. Rules:
 * - Logging in "today" (already counted) is a no-op — never double counts.
 * - Logging in exactly one calendar day after the last active date increments
 *   the current streak by 1.
 * - Missing one or more calendar days resets the current streak to 1 (today
 *   becomes day one of a new streak).
 * - Longest streak is monotonically preserved.
 * Call this once per session after login / on dashboard load.
 */
export async function updateStreak(userId) {
  const profile = await getProfile(userId)
  const today = getLocalYYYYMMDD()
  const last = profile?.last_active_date

  if (last === today) return profile // already counted today

  let newStreak = 1
  if (last) {
    const diffDays = daysBetweenDates(last, today)
    if (diffDays === 1) {
      newStreak = (profile.streak_count || 0) + 1
    } else if (diffDays <= 0) {
      // Defensive: clock skew or duplicate call — keep current streak.
      newStreak = profile.streak_count || 1
    } else {
      // diffDays > 1: at least one full day was missed. Streak resets.
      newStreak = 1
    }
  }

  const longest = Math.max(newStreak, profile?.longest_streak || 0)

  const updated = await updateProfile(userId, {
    streak_count: newStreak,
    longest_streak: longest,
    last_active_date: today,
  })

  // Award daily-login XP once per calendar day, after the streak is saved.
  return awardXP(userId, DAILY_LOGIN_XP, 'Daily Login')
    .catch(() => updated) // never block streak update on an XP hiccup
}

export async function awardXP(userId, amount, reason = '') {
  const profile = await getProfile(userId)
  let xp = (profile.xp || 0) + amount
  if (xp < 0) xp = 0
  const nextLevel = Math.floor(xp / 100) + 1
  const prevLevel = profile.level || 1

  // Badge unlock checks
  const badges = [...(profile.badges || [])]
  const addBadge = (b) => {
    if (!badges.includes(b)) badges.push(b)
  }

  if (nextLevel > prevLevel) {
    addBadge('Level Ascended ⚡')
  }
  if (xp >= 100) {
    addBadge('First Milestone 🏆')
  }
  if (xp >= 500) {
    addBadge('High Achiever 🌟')
  }
  if (profile.streak_count >= 3) {
    addBadge('Streak Starter 🔥')
  }
  if (profile.streak_count >= 7) {
    addBadge('Consistency Master 👑')
  }

  return updateProfile(userId, {
    xp,
    level: nextLevel,
    badges
  })
}

export async function healHeart(userId, amount = 1) {
  const profile = await getProfile(userId)
  const current = profile.hearts !== undefined ? profile.hearts : 3
  const next = Math.min(3, current + amount)
  return updateProfile(userId, { hearts: next })
}

