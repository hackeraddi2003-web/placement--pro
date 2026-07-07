import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CalendarDays, List, Smile, Zap, ChevronLeft, ChevronRight, Upload, Trash2, Plus } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import { getJournalEntries, upsertJournalEntry, deleteJournalEntry } from '../lib/api/journal'
import { awardXP } from '../lib/api/profile'
import { compressImage } from '../lib/imageCompressor'
import './JournalPage.css'

import { getLocalYYYYMMDD } from '../lib/supabaseClient'

const MOOD_EMOJI = ['😞', '😐', '🙂', '😄', '🤩']
const todayStr = () => getLocalYYYYMMDD()

export default function JournalPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [view, setView] = useState('timeline') // 'timeline' | 'calendar'
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [monthCursor, setMonthCursor] = useState(new Date())
  const [form, setForm] = useState(blankForm(todayStr()))
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  function blankForm(date) {
    return {
      entry_date: date, mood: 3, energy_level: 3, studied: '', learned: '',
      biggest_win: '', biggest_mistake: '', challenges: '', tomorrow_target: '',
      notes: '', study_hours: '',
    }
  }

  const load = useCallback(async () => {
    if (!user) return
    const data = await getJournalEntries(user.id, { limit: 200 })
    setEntries(data)
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const existing = entries.find((e) => e.entry_date === selectedDate)
    setForm(existing ? { ...existing, study_hours: existing.study_hours ?? '' } : blankForm(selectedDate))
  }, [selectedDate, entries])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, study_hours: parseFloat(form.study_hours) || 0 }
      const saved = await upsertJournalEntry(user.id, payload)

      setEntries((prev) => {
        const others = prev.filter((x) => x.entry_date !== saved.entry_date)
        return [saved, ...others].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      })
      await awardXP(user.id, 20, 'Journal entry written')
      setSavedMsg('Saved successfully')
      setTimeout(() => setSavedMsg(''), 1800)
    } catch (error) {
      console.error('[JournalPage] Save failed', error)
      const msg = error?.message ? String(error.message) : 'Save failed'
      setSavedMsg(`Error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!form.id) return
    if (!window.confirm('Delete this journal entry?')) return
    setSaving(true)
    try {
      await deleteJournalEntry(form.id)
      setEntries((prev) => prev.filter((entry) => entry.id !== form.id))
      setSelectedDate(todayStr())
      setSavedMsg('Deleted successfully')
      setTimeout(() => setSavedMsg(''), 1800)
    } catch (error) {
      console.error('[JournalPage] Delete failed', error)
      const msg = error?.message ? String(error.message) : 'Delete failed'
      setSavedMsg(`Error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleNewEntry = () => {
    const nextDate = todayStr()
    setSelectedDate(nextDate)
    setForm(blankForm(nextDate))
  }

  // Calendar grid
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const entryMap = Object.fromEntries(entries.map((e) => [e.entry_date, e]))

  const calendarCells = []
  for (let i = 0; i < startOffset; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Journal</h1>
          <p className="page-subtitle">One entry a day. This is the record your Mentor and Analytics read from.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" type="button" onClick={handleNewEntry}>
            <Plus size={14} /> New entry
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={handleDelete}
            disabled={!form.id || saving}
          >
            <Trash2 size={14} /> Delete
          </button>
          <div className="view-toggle">
            <button className={`view-toggle-btn ${view === 'timeline' ? 'is-active' : ''}`} onClick={() => setView('timeline')}>
              <List size={15} /> Timeline
            </button>
            <button className={`view-toggle-btn ${view === 'calendar' ? 'is-active' : ''}`} onClick={() => setView('calendar')}>
              <CalendarDays size={15} /> Calendar
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2col">
        <div>
          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title mono" style={{ color: 'var(--signal-amber)', fontWeight: 600 }}>{selectedDate}</span>
              {savedMsg && <span className="tag tag-teal">{savedMsg}</span>}
            </div>
            <form className="form-grid" onSubmit={handleSave}>
              <div className="form-row-2">
                <div>
                  <label className="label-eyebrow">Mood</label>
                  <div className="mood-picker">
                    {MOOD_EMOJI.map((emoji, i) => (
                      <button
                        type="button"
                        key={i}
                        className={`mood-btn ${form.mood === i + 1 ? 'is-active' : ''}`}
                        onClick={() => setForm({ ...form, mood: i + 1 })}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label-eyebrow">Energy level</label>
                  <div className="mood-picker">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        className={`mood-btn ${form.energy_level === lvl ? 'is-active' : ''}`}
                        onClick={() => setForm({ ...form, energy_level: lvl })}
                      >
                        <Zap size={14} fill={form.energy_level >= lvl ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="label-eyebrow">Study hours today</label>
                <input
                  className="input" type="number" step="0.5" min="0" max="24"
                  value={form.study_hours}
                  onChange={(e) => setForm({ ...form, study_hours: e.target.value })}
                  placeholder="e.g. 4.5"
                />
              </div>

              <Field label="What I studied" value={form.studied} onChange={(v) => setForm({ ...form, studied: v })} />
              <Field label="What I learned" value={form.learned} onChange={(v) => setForm({ ...form, learned: v })} />
              <div className="form-row-2">
                <Field label="Biggest win" value={form.biggest_win} onChange={(v) => setForm({ ...form, biggest_win: v })} />
                <Field label="Biggest mistake" value={form.biggest_mistake} onChange={(v) => setForm({ ...form, biggest_mistake: v })} />
              </div>
              <Field label="Challenges faced" value={form.challenges} onChange={(v) => setForm({ ...form, challenges: v })} />
              <Field label="Tomorrow's target" value={form.tomorrow_target} onChange={(v) => setForm({ ...form, tomorrow_target: v })} />
              <Field label="Personal notes & attachments" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

              <div className="journal-form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save entry'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={handleNewEntry} disabled={saving}>
                  New entry
                </button>
              </div>
            </form>
          </div>
        </div>

        <div>
          {view === 'calendar' ? (
            <div className="panel section-card">
              <div className="section-card-header">
                <button className="icon-btn" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}>
                  <ChevronLeft size={16} />
                </button>
                <span className="section-card-title">
                  {monthCursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </span>
                <button className="icon-btn" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}>
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="cal-grid">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="cal-dow">{d}</div>
                ))}
                {calendarCells.map((d, i) => {
                  if (!d) return <div key={i} />
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const entry = entryMap[dateStr]
                  return (
                    <button
                      key={i}
                      className={`cal-cell ${dateStr === selectedDate ? 'is-selected' : ''} ${entry ? 'has-entry' : ''}`}
                      onClick={() => setSelectedDate(dateStr)}
                    >
                      <span>{d}</span>
                      {entry && <span className="cal-mood">{MOOD_EMOJI[(entry.mood || 3) - 1]}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">Timeline</span>
              </div>
              {entries.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No entries yet" copy="Your first journal entry will show up here." />
              ) : (
                <div className="timeline-list">
                  {entries.slice(0, 30).map((e) => {
                    // strip image dataurl or large markdown from summary snippet
                    const cleanText = (e.biggest_win || e.studied || 'No notes')
                      .replace(/!\[.*?\]\(data:image\/.*?\)/g, '[Image]')
                      .substring(0, 80)
                    return (
                      <button key={e.id} className="timeline-item" onClick={() => setSelectedDate(e.entry_date)}>
                        <div className="timeline-item-date mono">{e.entry_date}</div>
                        <div className="timeline-item-mood">{MOOD_EMOJI[(e.mood || 3) - 1]}</div>
                        <div className="timeline-item-win" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanText}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function renderTextWithImages(text) {
  if (!text) return null
  const regex = /!\[(.*?)\]\((data:image\/.*?;base64,.*?)\)/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    const textBefore = text.substring(lastIndex, match.index)
    if (textBefore) {
      parts.push(<span key={lastIndex}>{textBefore}</span>)
    }
    const alt = match[1]
    const src = match[2]
    parts.push(
      <div key={match.index} style={{ margin: '10px 0', maxWidth: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-hairline)' }}>
        <img src={src} alt={alt} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block', background: 'rgba(0,0,0,0.2)' }} />
        {alt && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 10px', background: 'var(--bg-panel-raised)', borderTop: '1px solid var(--border-hairline)', fontFamily: 'var(--font-mono)' }}>{alt}</div>}
      </div>
    )
    lastIndex = regex.lastIndex
  }

  const textAfter = text.substring(lastIndex)
  if (textAfter) {
    parts.push(<span key={lastIndex}>{textAfter}</span>)
  }

  return <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{parts}</div>
}

function Field({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false)

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file, 800, 0.7)
      const imageMarkdown = `\n\n![${file.name}](${compressed})\n`
      onChange((value || '') + imageMarkdown)
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label className="label-eyebrow" style={{ marginBottom: 0 }}>{label}</label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--signal-teal)', cursor: 'pointer', fontWeight: 500 }}>
          <Upload size={12} />
          {uploading ? 'Compressing...' : 'Add Image'}
          <input type="file" accept="image/*" onChange={handleUploadImage} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>
      <textarea className="input" value={value || ''} onChange={(e) => onChange(e.target.value)} rows={2} style={{ lineHeight: 1.5 }} />

      {value && value.includes('data:image') && (
        <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-hairline)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>Inline Render Preview</div>
          {renderTextWithImages(value)}
        </div>
      )}
    </div>
  )
}
