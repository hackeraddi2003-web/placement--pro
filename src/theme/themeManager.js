export const THEME_STORAGE_KEY = 'placementos_pro_theme_preference'

export function getSystemTheme() {
    if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyThemeToDocument(resolvedTheme) {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    // Helps browser-native controls/scrollbars
    document.documentElement.style.colorScheme = resolvedTheme
}

export function resolveTheme(preference) {
    if (preference === 'system') return getSystemTheme()
    if (preference === 'light') return 'light'
    return 'dark'
}

export function readThemePreferenceFromStorage() {
    try {
        const raw = localStorage.getItem(THEME_STORAGE_KEY)
        if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
    } catch (_) { }
    return 'system'
}

export function writeThemePreferenceToStorage(preference) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch (_) { }
}

