import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CalendarDays, List, Smile, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import { getJournalEntries, upsertJournalEntry } from '../lib/api/journal'
import './JournalPage.css'

const MOOD_EMOJI = ['😞', '😐', '🙂', '😄', '🤩']
const todayStr = () => new Date().toISOString().slice(0, 10)

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
      console.log('[JournalPage] Save clicked', {
        userId: user?.id,
        selectedDate,
        form,
        rawStudyHours: form.study_hours,
      })

      const payload = { ...form, study_hours: parseFloat(form.study_hours) || 0 }
      console.log('[JournalPage] upsert payload', payload)

      const saved = await upsertJournalEntry(user.id, payload)
      console.log('[JournalPage] upsertJournalEntry response', saved)

      setEntries((prev) => {
        const others = prev.filter((e) => e.entry_date !== saved.entry_date)
        return [saved, ...others].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      })
      setSavedMsg('Saved')
      setTimeout(() => setSavedMsg(''), 1800)
    } catch (error) {
      console.log('[JournalPage] Save failed error object', error)
      const msg = error?.message ? String(error.message) : 'Save failed (unknown error)'
      setSavedMsg(`Error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  // Calendar grid for monthCursor
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
        <div className="view-toggle">
          <button className={`view-toggle-btn ${view === 'timeline' ? 'is-active' : ''}`} onClick={() => setView('timeline')}>
            <List size={15} /> Timeline
          </button>
          <button className={`view-toggle-btn ${view === 'calendar' ? 'is-active' : ''}`} onClick={() => setView('calendar')}>
            <CalendarDays size={15} /> Calendar
          </button>
        </div>
      </div>

      <div className="grid-2col">
        <div>
          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title mono">{selectedDate}</span>
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
              <Field label="Personal notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

              <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save entry'}
              </button>
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
                  {entries.slice(0, 30).map((e) => (
                    <button key={e.id} className="timeline-item" onClick={() => setSelectedDate(e.entry_date)}>
                      <div className="timeline-item-date mono">{e.entry_date}</div>
                      <div className="timeline-item-mood">{MOOD_EMOJI[(e.mood || 3) - 1]}</div>
                      <div className="timeline-item-win">{e.biggest_win || e.studied || 'No notes'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="label-eyebrow">{label}</label>
      <textarea className="input" value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
    </div>
  )
}
