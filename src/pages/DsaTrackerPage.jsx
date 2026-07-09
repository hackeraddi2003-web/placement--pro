import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Code2, Plus, ExternalLink, Flame, Trophy, CalendarDays, ListTree } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import ActivityHeatmap from '../components/ui/ActivityHeatmap'
import {
  ensureDsaTopicsSeeded, updateDsaTopic, getDsaProblems, addDsaProblem, deleteDsaProblem, updateDsaProblem,
  groupProblemsByDate, calculateSolvingStreak, xpForDifficulty,
} from '../lib/api/dsa'
import { awardXP } from '../lib/api/profile'
import { getLocalYYYYMMDD } from '../lib/supabaseClient'

const DIFFICULTY_COLOR = { Easy: '#2dd4bf', Medium: '#ff8a1f', Hard: '#f0566b' }

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started', color: 'neutral' },
  { value: 'in_progress', label: 'In progress', color: 'amber' },
  { value: 'completed', label: 'Completed', color: 'teal' },
  { value: 'revision_needed', label: 'Needs revision', color: 'red' },
]

const emptyProblemForm = () => ({
  problem_name: '', difficulty: 'Medium', link: '', notes: '',
  solved_date: getLocalYYYYMMDD(), time_minutes: '',
})

export default function DsaTrackerPage() {
  const { user } = useAuth()
  const [view, setView] = useState('topics') // 'topics' | 'history'
  const [topics, setTopics] = useState([])
  const [problems, setProblems] = useState([])
  const [activeTopic, setActiveTopic] = useState(null)
  const [showProblemModal, setShowProblemModal] = useState(false)
  const [newProblem, setNewProblem] = useState(emptyProblemForm())
  const [selectedProblem, setSelectedProblem] = useState(null)
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(getLocalYYYYMMDD())

  const load = useCallback(async () => {
    if (!user) return
    const [topicData, problemData] = await Promise.all([
      ensureDsaTopicsSeeded(user.id),
      getDsaProblems(user.id),
    ])
    setTopics(topicData.sort((a, b) => a.topic_name.localeCompare(b.topic_name)))
    setProblems(problemData)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleUpdateTopic = async (topic, updates) => {
    const updated = await updateDsaTopic(topic.id, updates)
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? updated : t)))
    if (activeTopic?.id === topic.id) setActiveTopic(updated)
  }

  const handleAddProblem = async (e) => {
    e.preventDefault()
    const timeMinutes = newProblem.time_minutes === '' ? 0 : parseInt(newProblem.time_minutes, 10) || 0
    const xpEarned = xpForDifficulty(newProblem.difficulty)

    if (selectedProblem) {
      // Editing an existing record updates only that record — it never
      // touches other dates' history. Keep xp_earned in sync if the
      // difficulty changed, so analytics never drift from the displayed value.
      const updated = await updateDsaProblem(selectedProblem.id, {
        ...newProblem, time_minutes: timeMinutes, xp_earned: xpEarned, topic_id: activeTopic.id,
      })
      setProblems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setSelectedProblem(null)
    } else {
      const created = await addDsaProblem(user.id, {
        ...newProblem, time_minutes: timeMinutes, xp_earned: xpEarned, topic_id: activeTopic.id,
      })
      setProblems((prev) => [created, ...prev])
      await handleUpdateTopic(activeTopic, { problems_solved: (activeTopic.problems_solved || 0) + 1 })
      await awardXP(user.id, xpEarned, 'DSA Problem Solved')
    }
    setNewProblem(emptyProblemForm())
    setShowProblemModal(false)
  }

  const handleDeleteProblem = async (id) => {
    await deleteDsaProblem(id)
    setProblems((prev) => prev.filter((p) => p.id !== id))
  }

  const topicProblems = activeTopic ? problems.filter((p) => p.topic_id === activeTopic.id) : []
  const totalSolved = problems.length
  const overallAvgProgress = topics.length
    ? Math.round(topics.reduce((s, t) => s + (t.progress_pct || 0), 0) / topics.length)
    : 0

  const today = getLocalYYYYMMDD()

  const problemsByDate = useMemo(() => groupProblemsByDate(problems), [problems])

  const streak = useMemo(() => calculateSolvingStreak(problems, today), [problems, today])

  const heatmapData = useMemo(() => {
    const map = {}
    for (const [date, list] of Object.entries(problemsByDate)) {
      map[date] = Math.min(list.length, 4)
    }
    return map
  }, [problemsByDate])

  const activeDates = useMemo(
    () => Object.keys(problemsByDate).sort((a, b) => (a < b ? 1 : -1)),
    [problemsByDate]
  )

  const dailyChartData = useMemo(() => {
    return activeDates.slice(0, 14).reverse().map((date) => ({
      date: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      solved: problemsByDate[date].length,
    }))
  }, [activeDates, problemsByDate])

  const difficultyChartData = useMemo(() => {
    const counts = { Easy: 0, Medium: 0, Hard: 0 }
    for (const p of problems) {
      if (counts[p.difficulty] !== undefined) counts[p.difficulty] += 1
    }
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name, value }))
  }, [problems])

  const totalXp = useMemo(() => problems.reduce((sum, p) => sum + (p.xp_earned || 0), 0), [problems])
  const totalMinutes = useMemo(() => problems.reduce((sum, p) => sum + (p.time_minutes || 0), 0), [problems])
  const selectedDateProblems = problemsByDate[selectedHistoryDate] || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">DSA & LeetCode Tracker</h1>
          <p className="page-subtitle">{totalSolved} problems solved · {overallAvgProgress}% average topic progress</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn ${view === 'topics' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('topics')}
          >
            <ListTree size={16} /> Topics
          </button>
          <button
            className={`btn ${view === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('history')}
          >
            <CalendarDays size={16} /> History & Analytics
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Current streak" value={`${streak.current}d`} icon={Flame} accent="amber" />
            <StatCard label="Longest streak" value={`${streak.longest}d`} icon={Trophy} accent="teal" />
            <StatCard label="Total XP earned" value={totalXp} icon={Trophy} accent="violet" />
            <StatCard label="Time invested" value={`${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m`} icon={Code2} accent="neutral" />
          </div>

          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title">Activity calendar</span>
            </div>
            <ActivityHeatmap data={heatmapData} weeks={18} />
          </div>

          {totalSolved === 0 ? (
            <div className="panel section-card">
              <EmptyState icon={CalendarDays} title="No history yet" copy="Solve a problem from the Topics tab and it'll show up here, organized by date." />
            </div>
          ) : (
            <div className="grid-2col">
              <div className="panel section-card">
                <div className="section-card-header">
                  <span className="section-card-title">Problems solved per day</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232a36" vertical={false} />
                    <XAxis dataKey="date" stroke="#9aa4b5" fontSize={11} />
                    <YAxis stroke="#9aa4b5" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#181e29', border: '1px solid #232a36' }} />
                    <Bar dataKey="solved" fill="#ff8a1f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="panel section-card">
                <div className="section-card-header">
                  <span className="section-card-title">Difficulty breakdown</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={difficultyChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {difficultyChartData.map((entry) => (
                        <Cell key={entry.name} fill={DIFFICULTY_COLOR[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#181e29', border: '1px solid #232a36' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid-2col">
            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">Active days ({activeDates.length})</span>
              </div>
              {activeDates.length === 0 ? (
                <EmptyState title="No days logged" copy="Dates you solve on will appear here." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto', width: '100%' }}>
                  {activeDates.map((date) => {
                    const list = problemsByDate[date]
                    const isSelected = date === selectedHistoryDate
                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedHistoryDate(date)}
                        className="btn btn-ghost"
                        style={{
                          justifyContent: 'space-between', width: '100%',
                          background: isSelected ? 'var(--bg-panel-raised)' : 'transparent',
                          border: isSelected ? '1px solid var(--border-active)' : '1px solid transparent',
                        }}
                      >
                        <span>{new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{date === today ? ' · Today' : ''}</span>
                        <span className="tag tag-neutral">{list.length} solved</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">
                  {new Date(`${selectedHistoryDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {selectedDateProblems.length === 0 ? (
                <EmptyState title="Nothing solved" copy="No problems recorded for this date." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {selectedDateProblems.map((p) => (
                    <div key={p.id} className="list-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14 }}>{p.problem_name}</div>
                        {p.notes && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.notes}</div>}
                      </div>
                      {p.time_minutes > 0 && <span className="tag tag-neutral">{p.time_minutes}m</span>}
                      <span className="tag tag-violet">+{p.xp_earned || xpForDifficulty(p.difficulty)} XP</span>
                      <span className={`tag ${p.difficulty === 'Hard' ? 'tag-red' : p.difficulty === 'Medium' ? 'tag-amber' : 'tag-teal'}`}>{p.difficulty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
      <div className="grid-2col">
        <div>
          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title">Topics</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topics.map((topic) => {
                const statusMeta = STATUS_OPTIONS.find((s) => s.value === topic.status) || STATUS_OPTIONS[0]
                return (
                  <button
                    key={topic.id}
                    className="list-row"
                    style={{ width: '100%', background: activeTopic?.id === topic.id ? 'var(--bg-panel-hover)' : 'none', border: 'none', borderRadius: 10, padding: '12px 14px', textAlign: 'left' }}
                    onClick={() => setActiveTopic(topic)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{topic.topic_name}</div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${topic.progress_pct || 0}%` }} />
                      </div>
                    </div>
                    <span className={`tag tag-${statusMeta.color}`} style={{ marginLeft: 12 }}>{statusMeta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div>
          {!activeTopic ? (
            <div className="panel section-card">
              <EmptyState icon={Code2} title="Select a topic" copy="Click a topic on the left to view and edit progress, notes, and solved problems." />
            </div>
          ) : (
            <>
              <div className="panel section-card">
                <div className="section-card-header">
                  <span className="section-card-title">{activeTopic.topic_name}</span>
                </div>
                <div className="form-grid">
                  <div>
                    <label className="label-eyebrow">Status</label>
                    <select
                      className="input"
                      value={activeTopic.status}
                      onChange={(e) => handleUpdateTopic(activeTopic, { status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-eyebrow">Progress: {activeTopic.progress_pct || 0}%</label>
                    <input
                      type="range" min="0" max="100" value={activeTopic.progress_pct || 0}
                      onChange={(e) => handleUpdateTopic(activeTopic, { progress_pct: parseInt(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="label-eyebrow">Notes</label>
                    <textarea
                      className="input" rows={3}
                      value={activeTopic.notes || ''}
                      onChange={(e) => setActiveTopic({ ...activeTopic, notes: e.target.value })}
                      onBlur={() => handleUpdateTopic(activeTopic, { notes: activeTopic.notes })}
                    />
                  </div>
                  <div>
                    <label className="label-eyebrow">Weak areas</label>
                    <input
                      className="input"
                      value={activeTopic.weak_areas || ''}
                      onChange={(e) => setActiveTopic({ ...activeTopic, weak_areas: e.target.value })}
                      onBlur={() => handleUpdateTopic(activeTopic, { weak_areas: activeTopic.weak_areas })}
                      placeholder="e.g. struggle with in-place modification"
                    />
                  </div>
                  <div className="form-row-2">
                    <div>
                      <label className="label-eyebrow">Last revised</label>
                      <input type="date" className="input" value={activeTopic.last_revised || ''} onChange={(e) => setActiveTopic({ ...activeTopic, last_revised: e.target.value })} onBlur={() => handleUpdateTopic(activeTopic, { last_revised: activeTopic.last_revised })} />
                    </div>
                    <div>
                      <label className="label-eyebrow">Next revision</label>
                      <input type="date" className="input" value={activeTopic.next_revision || ''} onChange={(e) => setActiveTopic({ ...activeTopic, next_revision: e.target.value })} onBlur={() => handleUpdateTopic(activeTopic, { next_revision: activeTopic.next_revision })} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel section-card">
                <div className="section-card-header">
                  <span className="section-card-title">Problems solved ({topicProblems.length})</span>
                  <button className="btn btn-ghost" onClick={() => { setSelectedProblem(null); setNewProblem(emptyProblemForm()); setShowProblemModal(true) }}><Plus size={16} /> Add</button>
                </div>
                {topicProblems.length === 0 ? (
                  <EmptyState title="No problems logged" copy="Add the problems you've solved for this topic." />
                ) : (
                  topicProblems.map((p) => (
                    <div key={p.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => { setSelectedProblem(p); setNewProblem({ problem_name: p.problem_name, difficulty: p.difficulty || 'Medium', link: p.link || '', notes: p.notes || '', solved_date: p.solved_date || getLocalYYYYMMDD(), time_minutes: p.time_minutes ?? '' }); setShowProblemModal(true); }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14 }}>{p.problem_name}</div>
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11, color: 'var(--signal-teal)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            View <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <span className={`tag ${p.difficulty === 'Hard' ? 'tag-red' : p.difficulty === 'Medium' ? 'tag-amber' : 'tag-teal'}`}>{p.difficulty}</span>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleDeleteProblem(p.id) }} style={{ fontSize: 12 }}>✕</button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {showProblemModal && (
        <Modal
          title={selectedProblem ? `Edit problem — ${activeTopic.topic_name}` : `Add problem — ${activeTopic.topic_name}`}
          onClose={() => { setShowProblemModal(false); setSelectedProblem(null); setNewProblem(emptyProblemForm()) }}
        >
          <form className="form-grid" onSubmit={handleAddProblem}>
            <input className="input" autoFocus placeholder="Problem name" required value={newProblem.problem_name} onChange={(e) => setNewProblem({ ...newProblem, problem_name: e.target.value })} />
            <div className="form-row-2">
              <select className="input" value={newProblem.difficulty} onChange={(e) => setNewProblem({ ...newProblem, difficulty: e.target.value })}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
              <input className="input" placeholder="Link (optional)" value={newProblem.link} onChange={(e) => setNewProblem({ ...newProblem, link: e.target.value })} />
            </div>
            <div className="form-row-2">
              <div>
                <label className="label-eyebrow">Date solved</label>
                <input
                  type="date" className="input" max={getLocalYYYYMMDD()}
                  value={newProblem.solved_date}
                  onChange={(e) => setNewProblem({ ...newProblem, solved_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label-eyebrow">Time spent (min)</label>
                <input
                  type="number" min="0" className="input" placeholder="e.g. 25"
                  value={newProblem.time_minutes}
                  onChange={(e) => setNewProblem({ ...newProblem, time_minutes: e.target.value })}
                />
              </div>
            </div>
            <textarea className="input" placeholder="Notes (optional)" rows={2} value={newProblem.notes} onChange={(e) => setNewProblem({ ...newProblem, notes: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowProblemModal(false); setSelectedProblem(null); setNewProblem(emptyProblemForm()) }}>Cancel</button>
              <button type="submit" className="btn btn-primary">{selectedProblem ? 'Save changes' : 'Add problem'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
