import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const LAST_USER_KEY = 'placementos_last_user_id'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
          setSession(JSON.parse(offlineSession))
        }
      } catch (e) {
        console.error('Failed to load offline session:', e)
      }
      setLoading(false)
      return
    }

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

  const signUp = async (email, password, fullName) => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    const isConfigured = !!(
      url && key &&
      url !== 'https://placeholder-project.supabase.co' &&
      key !== 'placeholder-anon-key'
    )

    if (!isConfigured) {
      try {
        const users = JSON.parse(localStorage.getItem('placementos_offline_users') || '[]')
        if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('User already exists.')
        }
        const newUser = {
          id: `offline_user_${Date.now()}`,
          email,
          password,
          user_metadata: { full_name: fullName }
        }
        users.push(newUser)
        localStorage.setItem('placementos_offline_users', JSON.stringify(users))

        const newSession = {
          user: {
            id: newUser.id,
            email: newUser.email,
            user_metadata: newUser.user_metadata
          }
        }
        localStorage.setItem('placementos_offline_session', JSON.stringify(newSession))
        setSession(newSession)
        return { data: { user: newSession.user }, error: null }
      } catch (err) {
        return { data: null, error: err }
      }
    }

    return supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
  }

  const signIn = async (email, password) => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    const isConfigured = !!(
      url && key &&
      url !== 'https://placeholder-project.supabase.co' &&
      key !== 'placeholder-anon-key'
    )

    if (!isConfigured) {
      try {
        const users = JSON.parse(localStorage.getItem('placementos_offline_users') || '[]')
        const user = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        )
        if (!user) {
          throw new Error('Invalid login credentials.')
        }
        const newSession = {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata
          }
        }
        localStorage.setItem('placementos_offline_session', JSON.stringify(newSession))
        setSession(newSession)
        return { data: { session: newSession, user: newSession.user }, error: null }
      } catch (err) {
        return { data: null, error: err }
      }
    }

    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    const isConfigured = !!(
      url && key &&
      url !== 'https://placeholder-project.supabase.co' &&
      key !== 'placeholder-anon-key'
    )

    if (!isConfigured) {
      localStorage.removeItem('placementos_offline_session')
      setSession(null)
      return
    }

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

