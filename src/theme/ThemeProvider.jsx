import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getProfile, saveThemePreference } from '../lib/api/profile'
import { resolveTheme, applyThemeToDocument, readThemePreferenceFromStorage, writeThemePreferenceToStorage } from './themeManager'

import { useAuth } from '../hooks/useAuth'


const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [preference, setPreference] = useState('system')

    useEffect(() => {
        let cancelled = false

        async function init() {
            // 1) localStorage (fast path)
            const localPref = readThemePreferenceFromStorage()

            if (user?.id) {
                // 2) Supabase profile preference (authoritative once signed in)
                try {
                    const profile = await getProfile(user.id)
                    const supaPref = profile?.theme_preference
                    const nextPref = supaPref || localPref || 'system'
                    if (!cancelled) {
                        setPreference(nextPref)
                        applyThemeToDocument(resolveTheme(nextPref))
                    }
                } catch (e) {
                    // fallback to local
                    if (!cancelled) {
                        setPreference(localPref)
                        applyThemeToDocument(resolveTheme(localPref))
                    }
                }
            } else {
                setPreference(localPref)
                applyThemeToDocument(resolveTheme(localPref))
            }

            if (!cancelled) setLoading(false)
        }

        init()
        return () => {
            cancelled = true
        }
    }, [user])

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return

        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => {
            // Only re-apply on system changes when in system mode.
            if (preference !== 'system') return
            applyThemeToDocument(resolveTheme('system'))
        }


        // We don't want to override state; just update document.
        if (preference === 'system') {
            applyThemeToDocument(resolveTheme('system'))
        }

        if (mql.addEventListener) mql.addEventListener('change', handler)
        else mql.addListener(handler)

        return () => {
            if (mql.removeEventListener) mql.removeEventListener('change', handler)
            else mql.removeListener(handler)
        }
    }, [preference])

    const setThemePreference = async (nextPreference) => {
        setPreference(nextPreference)
        writeThemePreferenceToStorage(nextPreference)
        applyThemeToDocument(resolveTheme(nextPreference))
        if (user?.id) {
            saveThemePreference(user.id, nextPreference).catch(() => { })
        }
    }

    const value = useMemo(() => ({
        loading,
        preference,
        setThemePreference,
        resolvedTheme: resolveTheme(preference),
    }), [loading, preference])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
    return ctx
}


