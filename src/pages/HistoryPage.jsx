import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getLocalYYYYMMDD } from '../lib/supabaseClient'
import { getTasksInRange } from '../lib/api/tasks'
import EmptyState from '../components/ui/EmptyState'
import { Calendar, Check, X, ChevronLeft, ChevronRight, History as HistoryIcon } from 'lucide-react'

// How far back we look for archived days. Data itself is never deleted —
// this just bounds how much we fetch/render at once.
const RANGE_DAYS = 180

function daysAgoStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return getLocalYYYYMMDD(d)
}

function formatLong(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function HistoryPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [allTasks, setAllTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(getLocalYYYYMMDD())

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    getTasksInRange(user.id, daysAgoStr(RANGE_DAYS), getLocalYYYYMMDD())
      .then((data) => {
        if (!cancelled) setAllTasks(Array.isArray(data) ? data : [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user])

  const tasksByDate = useMemo(() => {
    const map = {}
    for (const t of allTasks) {
      if (!map[t.task_date]) map[t.task_date] = []
      map[t.task_date].push(t)
    }
    return map
  }, [allTasks])

  // Every date with at least one archived task, newest first. This is what
  // makes history durable: nothing is deleted, we just index by date.
  const activeDates = useMemo(
    () => Object.keys(tasksByDate).sort((a, b) => (a < b ? 1 : -1)),
    [tasksByDate]
  )

  const selectedTasks = tasksByDate[selectedDate] || []
  const completedCount = selectedTasks.filter((t) => t.is_completed).length
  const today = getLocalYYYYMMDD()

  const shiftDate = (deltaDays) => {
    const [y, m, d] = selectedDate.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + deltaDays)
    setSelectedDate(dt.toISOString().slice(0, 10))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Task History</h1>
          <p className="page-subtitle">
            Every day's tasks are archived by date automatically — nothing is ever overwritten or lost.
          </p>
        </div>
      </div>

      <div className="grid-2col">
        <div className="panel section-card">
          <div className="section-card-header">
            <span className="section-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HistoryIcon size={16} />
              Active Days {!loading && `(${activeDates.length})`}
            </span>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</p>
          ) : activeDates.length === 0 ? (
            <EmptyState icon={HistoryIcon} title="No history yet" copy="Complete some daily tasks and they'll show up here, organized by date." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 440, overflowY: 'auto', width: '100%' }}>
              {activeDates.map((date) => {
                const dayTasks = tasksByDate[date]
                const done = dayTasks.filter((t) => t.is_completed).length
                const isSelected = date === selectedDate
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className="btn btn-ghost"
                    style={{
                      justifyContent: 'space-between',
                      width: '100%',
                      background: isSelected ? 'var(--bg-panel-raised)' : 'transparent',
                      border: isSelected ? '1px solid var(--border-active)' : '1px solid transparent',
                    }}
                  >
                    <span>{formatShort(date)}{date === today ? ' · Today' : ''}</span>
                    <span className="tag tag-neutral">{done}/{dayTasks.length}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel section-card">
          <div className="section-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="section-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} />
              {formatLong(selectedDate)}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="icon-btn" onClick={() => shiftDate(-1)} aria-label="Previous day">
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input"
                style={{ padding: '4px 8px', fontSize: 12 }}
              />
              <button
                className="icon-btn"
                onClick={() => shiftDate(1)}
                disabled={selectedDate >= today}
                aria-label="Next day"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {selectedTasks.length === 0 ? (
            <EmptyState icon={Calendar} title="No tasks recorded" copy="No tasks were logged for this date." />
          ) : (
            <>
              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {completedCount} / {selectedTasks.length} completed
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {selectedTasks
                  .slice()
                  .sort((a, b) => a.priority - b.priority)
                  .map((t) => (
                    <div key={t.id} className="list-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {t.is_completed
                        ? <Check size={16} color="var(--signal-teal)" />
                        : <X size={16} color="var(--text-tertiary)" />}
                      <span style={{
                        textDecoration: t.is_completed ? 'line-through' : 'none',
                        color: t.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      }}>
                        {t.title}
                      </span>
                      <span className="tag tag-neutral" style={{ marginLeft: 'auto' }}>{t.category}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
