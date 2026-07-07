import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Missing Supabase env vars. Running in offline/localStorage fallback mode. See README.md to configure Supabase.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export async function getAuthenticatedUserId() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const isConfigured = !!(
    url && key &&
    url !== 'https://placeholder-project.supabase.co' &&
    key !== 'placeholder-anon-key'
  )

  if (!isConfigured) {
    try {
      const offlineSession = localStorage.getItem('placementos_offline_session')
      if (offlineSession) {
        const parsed = JSON.parse(offlineSession)
        const userId = parsed?.user?.id
        if (userId) return userId
      }
    } catch (e) {
      console.error('Failed to get offline session userId:', e)
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) {
    throw new Error('Authenticated user is required for this operation.')
  }
  return userId
}

export function getLocalYYYYMMDD(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


