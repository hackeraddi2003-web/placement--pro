import { useMemo } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../../theme/ThemeProvider'

export default function ThemeToggle({ compact = false }) {
    const { preference, resolvedTheme, setThemePreference } = useTheme()

    const mode = useMemo(() => {
        if (preference === 'system') return { key: 'system', label: 'System', Icon: Monitor }
        if (preference === 'light') return { key: 'light', label: 'Light', Icon: Sun }
        return { key: 'dark', label: 'Dark', Icon: Moon }
    }, [preference])

    const nextLabel = (() => {
        // Toggle between explicit light/dark quickly; keep "system" as-is.
        if (preference === 'system') return resolvedTheme === 'dark' ? 'Light' : 'Dark'
        return preference === 'dark' ? 'Light' : 'Dark'
    })()

    const applyQuickToggle = () => {
        if (preference === 'system') {
            // Switch to explicit opposite of current resolved theme.
            setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark')
            return
        }
        setThemePreference(preference === 'dark' ? 'light' : 'dark')
    }

    return (
        <button
            type="button"
            className="btn btn-ghost"
            onClick={applyQuickToggle}
            aria-label="Toggle dark/light"
            title={`Current: ${preference === 'system' ? 'System' : preference}. Click to switch.`}
            style={{
                padding: compact ? '8px 10px' : undefined,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                }}
            >
                <mode.Icon size={16} color={mode.key === 'light' ? 'var(--signal-amber)' : mode.key === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)'} />
            </span>
            {compact ? null : (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {preference === 'system' ? `System (${resolvedTheme})` : preference[0].toUpperCase() + preference.slice(1)}
                    {' '}•{' '}
                    Switch to {nextLabel}
                </span>
            )}
        </button>
    )
}

