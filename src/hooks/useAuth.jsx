import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { offlineDb } from '../lib/offlineDb'

const AuthContext = createContext(null)

// Key to remember the last logged-in userId across page refreshes
const LAST_USER_KEY = 'placementos_last_user_id'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.id) {
        localStorage.setItem(LAST_USER_KEY, session.user.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user?.id) {
        localStorage.setItem(LAST_USER_KEY, session.user.id)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signUp = (email, password, fullName) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })

  const signOut = async () => {
    // NOTE: We intentionally do NOT clear localStorage cache on logout
    // so that if the same user logs back in, all their data loads instantly
    // from cache before Supabase responds. To clear data, use Settings > Clear Data.
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user || null,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
