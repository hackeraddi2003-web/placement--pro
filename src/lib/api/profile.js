import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { encryptApiKey, decryptApiKey } from '../cryptoHelper'
import { offlineDb } from '../offlineDb'

export async function getProfile(userId) {
  // profiles table uses 'id' (not 'user_id') so we use a direct localStorage key
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
        localStorage.setItem(cacheKey, JSON.stringify([data]))
        return data
      }

      if (!error && !data) {
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({ id: userId, full_name: 'Placement Candidate', target_role: 'SDE / AI-ML Engineer' })
          .select()
          .single()
        if (createError) throw createError
        localStorage.setItem(cacheKey, JSON.stringify([created]))
        return created
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
      if (list && list.length > 0) return list[0]
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
    const merged = { ...(idx >= 0 ? list[idx] : { id: userId }), ...updates, updated_at: new Date().toISOString() }
    if (idx >= 0) list[idx] = merged; else list.push(merged)
    localStorage.setItem(cacheKey, JSON.stringify(list))
  } catch { }

  // Sync to Supabase
  if (offlineDb.isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select()
        .single()
      if (!error && data) {
        localStorage.setItem(cacheKey, JSON.stringify([data]))
        return data
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
 * Updates streak based on last_active_date.
 * Call this once per session after login / on dashboard load.
 */
export async function updateStreak(userId) {
  const profile = await getProfile(userId)
  const today = new Date().toISOString().slice(0, 10)
  const last = profile?.last_active_date

  if (last === today) return profile // already counted today

  let newStreak = 1
  if (last) {
    const diffDays = Math.round((new Date(today) - new Date(last)) / 86400000)
    if (diffDays === 1) {
      newStreak = (profile.streak_count || 0) + 1
    } else if (diffDays === 0) {
      newStreak = profile.streak_count || 1
    }
    // diffDays > 1 → streak broken, resets to 1
  }

  const longest = Math.max(newStreak, profile?.longest_streak || 0)

  return updateProfile(userId, {
    streak_count: newStreak,
    longest_streak: longest,
    last_active_date: today,
  })
}
