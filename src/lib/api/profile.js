import { supabase } from '../supabaseClient'
import { encryptApiKey, decryptApiKey } from '../cryptoHelper'

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
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
  const apiKey = profile.ai_api_key_encrypted
    ? await decryptApiKey(profile.ai_api_key_encrypted, userId)
    : ''
  return { provider: profile.ai_provider || 'none', apiKey }
}

/**
 * Updates streak based on last_active_date.
 * Call this once per session after login / on dashboard load.
 */
export async function updateStreak(userId) {
  const profile = await getProfile(userId)
  const today = new Date().toISOString().slice(0, 10)
  const last = profile.last_active_date

  if (last === today) return profile // already counted today

  let newStreak = 1
  if (last) {
    const lastDate = new Date(last)
    const todayDate = new Date(today)
    const diffDays = Math.round((todayDate - lastDate) / 86400000)
    if (diffDays === 1) {
      newStreak = (profile.streak_count || 0) + 1
    } else if (diffDays === 0) {
      newStreak = profile.streak_count || 1
    } // diffDays > 1 -> streak broken, resets to 1
  }

  const longest = Math.max(newStreak, profile.longest_streak || 0)

  return updateProfile(userId, {
    streak_count: newStreak,
    longest_streak: longest,
    last_active_date: today,
  })
}
