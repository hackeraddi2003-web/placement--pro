import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { KeyRound, Download, Upload, LogOut, ShieldAlert, CheckCircle2, Monitor, Sun, Moon } from 'lucide-react'
import { loadAiSettings, saveAiSettings, getProfile } from '../lib/api/profile'
import { supabase } from '../lib/supabaseClient'
import { useTheme } from '../theme/ThemeProvider'


const PROVIDERS = [
  { value: 'none', label: 'No AI (rule-based only)' },
  { value: 'gemini', label: 'Google Gemini (gemini-2.0-flash, free tier)' },
  { value: 'openai', label: 'OpenAI (gpt-4o-mini)' },
  { value: 'claude', label: 'Anthropic Claude (claude-sonnet-4-6)' },
]

const EXPORT_TABLES = [
  'journal_entries', 'english_logs', 'dsa_topics', 'dsa_problems',
  'language_progress', 'subject_progress', 'projects', 'interview_questions',
  'job_applications', 'mentor_reviews', 'daily_tasks', 'goals',
]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { preference, setThemePreference } = useTheme()
  const [provider, setProvider] = useState('none')

  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    if (!user) return
    const settings = await loadAiSettings(user.id)
    setProvider(settings.provider)
    setApiKey(settings.apiKey)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await saveAiSettings(user.id, provider, apiKey)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const profile = await getProfile(user.id)
      const tableData = {}
      for (const table of EXPORT_TABLES) {
        const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id)
        if (error) throw error
        tableData[table] = data
      }
      const exportPayload = {
        exported_at: new Date().toISOString(),
        app: 'PlacementOS Pro',
        version: 1,
        profile: {
          full_name: profile.full_name,
          streak_count: profile.streak_count,
          longest_streak: profile.longest_streak,
        },
        data: tableData,
      }
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `placementos-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setImporting(true)
    setImportMsg('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed?.data) throw new Error('This file does not look like a PlacementOS Pro backup.')

      let restoredRows = 0
      for (const table of EXPORT_TABLES) {
        const rows = parsed.data[table]
        if (!Array.isArray(rows) || rows.length === 0) continue
        // Strip any user_id from the file and force the current session's user_id,
        // so a backup can never be used to write into someone else's account.
        const safeRows = rows.map(({ id, user_id, ...rest }) => ({ ...rest, id, user_id: user.id }))

        // Use business keys for upsert to avoid duplicates (e.g., journal_entries has unique(user_id, entry_date)).
        let onConflict = 'id'
        if (table === 'journal_entries') onConflict = 'user_id,entry_date'
        if (table === 'dsa_topics') onConflict = 'user_id,topic_name'
        if (table === 'language_progress') onConflict = 'user_id,language'
        if (table === 'subject_progress') onConflict = 'user_id,subject'
        if (table === 'mentor_reviews') onConflict = 'user_id,review_date'

        const { error } = await supabase.from(table).upsert(safeRows, { onConflict })

        if (error) throw error
        restoredRows += safeRows.length
      }
      setImportMsg(`Restored ${restoredRows} records from backup. Refresh any open pages to see the data.`)
    } catch (err) {
      setImportMsg(`Import failed: ${err.message}`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">AI provider, data backup, and account</p>
        </div>
      </div>

      <div className="panel section-card" style={{ marginBottom: 20 }}>
        <div className="section-card-header">
          <span className="section-card-title">AI provider</span>
          <KeyRound size={16} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          Optional. Without a key, every AI feature (Mentor review, English Hub tasks) uses built-in rule-based generation — the app is fully usable with zero cost. Your key is stored encrypted in your own Supabase project, never sent anywhere except directly to the provider you choose.
        </p>
        <form className="form-grid" onSubmit={handleSave}>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {provider !== 'none' && (
            <input
              className="input" type="password" placeholder="Paste your API key"
              value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save AI settings'}
            </button>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--signal-teal)' }}>
                <CheckCircle2 size={14} /> Saved
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="panel section-card" style={{ marginBottom: 20 }}>
        <div className="section-card-header">
          <span className="section-card-title">Backup & restore</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          Your data already lives in Supabase and syncs across every device you log into. Use export for an offline JSON copy (e.g. before deleting your account) and import to restore it.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export all data (.json)'}
          </button>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={16} /> {importing ? 'Importing…' : 'Import from backup'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
        {importMsg && (
          <p style={{ fontSize: 12.5, marginTop: 12, color: importMsg.startsWith('Import failed') ? 'var(--signal-red)' : 'var(--signal-teal)' }}>
            {importMsg}
          </p>
        )}
      </div>

      <div className="panel section-card" style={{ marginBottom: 20 }}>
        <div className="section-card-header">
          <span className="section-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={15} style={{ color: 'var(--signal-amber)' }} /> A note on API key storage
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          Your AI API key is encrypted client-side (AES-GCM) before being saved to your Supabase profile. This protects against casual exposure, but since the key is derived from your user ID, it isn't a substitute for a real secrets manager. For a personal tool this is a reasonable trade-off; avoid using a key tied to a paid account with a high spending limit.
        </p>
      </div>

      <div className="panel section-card" style={{ marginBottom: 20 }}>
        <div className="section-card-header">
          <span className="section-card-title">Theme</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Choose your visual cockpit theme. Selecting System will automatically sync the appearance with your operating system preference.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { value: 'system', label: 'System', desc: 'Sync with OS', icon: Monitor },
            { value: 'light', label: 'Light', desc: 'Bright panel', icon: Sun },
            { value: 'dark', label: 'Dark', desc: 'Dark cockpit', icon: Moon }
          ].map((opt) => {
            const Icon = opt.icon
            const isActive = preference === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '18px 12px',
                  background: isActive ? 'var(--bg-panel-hover)' : 'var(--bg-panel-raised)',
                  border: '1.5px solid',
                  borderColor: isActive ? 'var(--signal-amber)' : 'var(--border-hairline)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                  boxShadow: isActive ? '0 0 0 3px var(--signal-amber-glow)' : 'none',
                  outline: 'none'
                }}
                onClick={() => setThemePreference(opt.value)}
              >
                <Icon size={20} color={isActive ? 'var(--signal-amber)' : 'var(--text-secondary)'} style={{ marginBottom: 8 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 3 }}>{opt.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="panel section-card">
        <div className="section-card-header">
          <span className="section-card-title">Account</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>{user?.email}</p>
        <button className="btn btn-ghost" onClick={signOut} style={{ color: 'var(--signal-red)' }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  )
}

