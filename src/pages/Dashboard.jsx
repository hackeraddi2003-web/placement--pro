import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getLocalYYYYMMDD } from '../lib/supabaseClient'
import {
  Flame, Clock, ListChecks, TrendingUp, Target, Plus, Check,
  Heart, Trophy, ShieldAlert, Sparkles, Award
} from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import ReadinessGauge from '../components/ui/ReadinessGauge'
import ActivityHeatmap from '../components/ui/ActivityHeatmap'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { getProfile, updateStreak, awardXP, healHeart, updateProfile } from '../lib/api/profile'
import {
  getTasksByDate,
  getPastUncompletedTasks,
  addTask,
  toggleTask,
  updateTask,
  deleteTask,
  upsertDailyTaskStats,
  getDailyTaskStatsByDate,
  getGoals,
  addGoal,
  toggleGoal,
} from '../lib/api/tasks'
import { getJournalEntries } from '../lib/api/journal'
import { getDsaTopics } from '../lib/api/dsa'
import { getProjects } from '../lib/api/projects'
import { getSubjectProgress } from '../lib/api/skills'
import { getEnglishLogs } from '../lib/api/english'
import { getInterviewQuestions } from '../lib/api/interview'
import { calculateReadinessScore } from '../lib/readinessScore'
import ThemeToggle from '../components/ui/ThemeToggle'

const todayStr = () => getLocalYYYYMMDD()


export default function Dashboard() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const [tasks, setTasks] = useState([])
  const [taskStats, setTaskStats] = useState(null)
  const [taskProgressPct, setTaskProgressPct] = useState(0)

  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')

  const [goals, setGoals] = useState([])
  const [journalEntries, setJournalEntries] = useState([])

  const [readiness, setReadiness] = useState({ overall: 0, breakdown: {} })
  const [heatmapData, setHeatmapData] = useState({})

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalDate, setNewGoalDate] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const today = todayStr()

      // Rollover past uncompleted tasks to today
      try {
        const pastTasks = await getPastUncompletedTasks(user.id, today)
        if (pastTasks && pastTasks.length > 0) {
          await Promise.all(pastTasks.map((t) => updateTask(t.id, { task_date: today })))
        }
      } catch (err) {
        console.warn('Failed to rollover past uncompleted tasks:', err)
      }

      const results = await Promise.allSettled([
        updateStreak(user.id),
        getTasksByDate(user.id, today),
        getGoals(user.id),
        getJournalEntries(user.id, { limit: 90 }),
        getDsaTopics(user.id),
        getProjects(user.id),
        getSubjectProgress(user.id),
        getEnglishLogs(user.id, { limit: 30 }),
        getInterviewQuestions(user.id),
        getDailyTaskStatsByDate(user.id, today),
      ])

      const [
        profileData, todayTasks, goalsData, journals,
        dsaTopics, projects, subjects, englishLogs, interviewQs, statsData,
      ] = results.map((r) => (r.status === 'fulfilled' ? r.value : null))

      setProfile(profileData || {})
      setTasks(Array.isArray(todayTasks) ? todayTasks : [])
      setTaskStats(statsData || null)
      setTaskProgressPct(typeof statsData?.completion_pct === 'number' ? statsData.completion_pct : 0)

      setGoals(Array.isArray(goalsData) ? goalsData.filter((g) => !g.is_completed).slice(0, 5) : [])
      setJournalEntries(Array.isArray(journals) ? journals : [])

      setReadiness(
        calculateReadinessScore({
          dsaTopics: Array.isArray(dsaTopics) ? dsaTopics : [],
          projects: Array.isArray(projects) ? projects : [],
          subjects: Array.isArray(subjects) ? subjects : [],
          englishLogs: Array.isArray(englishLogs) ? englishLogs : [],
          interviewQuestions: Array.isArray(interviewQs) ? interviewQs : [],
          streak: profileData?.streak_count || 0,
        })
      )

      const map = {}
      if (Array.isArray(journals)) {
        journals.forEach((j) => {
          const intensity = j.study_hours >= 4 ? 4 : j.study_hours >= 2 ? 3 : j.study_hours > 0 ? 2 : 1
          map[j.entry_date] = intensity
        })
      }
      setHeatmapData(map)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }

  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const recalcAndPersistTaskStats = useCallback(async (nextTasks) => {
    if (!user) return

    const totalTasks = nextTasks.length
    const completedTasks = nextTasks.filter((t) => t.is_completed).length
    const completionPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

    const payload = {
      task_date: todayStr(),
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completion_pct: completionPct,
    }

    await upsertDailyTaskStats(user.id, payload)
    setTaskStats({ ...payload, user_id: user.id })
    setTaskProgressPct(completionPct)
  }, [user])

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    const created = await addTask(user.id, {
      title: newTaskTitle.trim(),
      task_date: todayStr(),
    })

    const next = [...tasks, created]
    setTasks(next)
    await recalcAndPersistTaskStats(next)

    setNewTaskTitle('')
    setShowTaskModal(false)
  }

  const handleToggleTask = async (task) => {
    const updated = await toggleTask(task.id, !task.is_completed)
    const next = tasks.map((t) => (t.id === task.id ? updated : t))
    setTasks(next)
    await recalcAndPersistTaskStats(next)

    // Award XP
    await awardXP(user.id, updated.is_completed ? 10 : -10, 'Task Toggled')
    const updatedProfile = await getProfile(user.id)
    setProfile(updatedProfile)
  }

  const startEditingTask = (task) => {
    setEditingTaskId(task.id)
    setEditTaskTitle(task.title)
  }

  const cancelEditingTask = () => {
    setEditingTaskId(null)
    setEditTaskTitle('')
  }

  const handleUpdateTask = async (task) => {
    if (!editTaskTitle.trim()) return

    const updated = await updateTask(task.id, { title: editTaskTitle.trim() })
    const next = tasks.map((t) => (t.id === task.id ? updated : t))
    setTasks(next)

    await recalcAndPersistTaskStats(next)
    cancelEditingTask()
  }

  const handleDeleteTask = async (task) => {
    await deleteTask(task.id)
    const next = tasks.filter((t) => t.id !== task.id)
    setTasks(next)

    await recalcAndPersistTaskStats(next)
  }

  const handleAddGoal = async (e) => {
    e.preventDefault()
    if (!newGoalTitle.trim()) return

    const created = await addGoal(user.id, {
      title: newGoalTitle.trim(),
      target_date: newGoalDate || null,
    })

    setGoals((prev) => [...prev, created])
    setNewGoalTitle('')
    setNewGoalDate('')
    setShowGoalModal(false)
  }

  const handleClaimQuest = async () => {
    if (completedToday < 2) return

    await awardXP(user.id, 25, 'Daily Quest Completed')
    await healHeart(user.id, 1)

    const updated = await updateProfile(user.id, {
      daily_quest_completed: true,
      last_quest_date: todayStr()
    })
    setProfile(updated)
  }

  const completedToday = tasks.filter((t) => t.is_completed).length
  const totalTodayTasks = tasks.length
  const dailyCompletionLabel = totalTodayTasks === 0 ? '0%' : `${taskProgressPct}%`

  const weekStudyHours = journalEntries
    .filter((j) => {
      const d = new Date(j.entry_date)
      const now = new Date()
      const diff = (now - d) / 86400000
      return diff <= 7
    })
    .reduce((sum, j) => sum + (j.study_hours || 0), 0)

  if (loading) {
    return <EmptyState title="Loading dashboard…" copy="Pulling your latest progress from the cloud." />
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} — here's where you stand.
          </p>
        </div>

        <ThemeToggle />
      </div>


      <div className="grid-stats">
        <StatCard icon={Flame} label="Daily Streak" value={`${profile?.streak_count || 0}d`} accent="amber" />
        <StatCard icon={Clock} label="Study Hours (7d)" value={`${weekStudyHours.toFixed(1)}h`} accent="teal" />
        <StatCard icon={ListChecks} label="Today's Tasks" value={`${completedToday}/${tasks.length}`} accent="violet" />
        <StatCard icon={TrendingUp} label="Longest Streak" value={`${profile?.longest_streak || 0}d`} accent="red" />
      </div>

      <div className="grid-2col">
        <div>
          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                Today's Tasks
                <span className="tag tag-amber" style={{ marginLeft: 'auto' }}>{dailyCompletionLabel}</span>
              </span>
              <button className="btn btn-ghost" onClick={() => setShowTaskModal(true)}>
                <Plus size={16} /> Add
              </button>
            </div>

            <div style={{ marginTop: -4, marginBottom: 14, width: '100%' }}>
              <div className="progress-track" aria-label="Daily completion progress">
                <div className="progress-fill" style={{ width: `${taskProgressPct}%` }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span>
                  {completedToday}/{totalTodayTasks} completed
                </span>
                <span>{totalTodayTasks === 0 ? 'Log tasks to start tracking' : `${taskProgressPct}% today`}</span>
              </div>
            </div>

            {tasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks logged for today"
                copy="Add your first task to start tracking the day."
              />
            ) : (
              tasks.map((task) => (
                <div className="list-row" key={task.id}>
                  <button
                    onClick={() => handleToggleTask(task)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      color: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        flexShrink: 0,
                        border: `1.5px solid ${task.is_completed ? 'var(--signal-teal)' : 'var(--border-active)'}`,
                        background: task.is_completed ? 'var(--signal-teal)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {task.is_completed && <Check size={13} color="#0a0d12" strokeWidth={3} />}
                    </span>

                    {editingTaskId === task.id ? (
                      <input
                        className="input"
                        style={{ maxWidth: 420 }}
                        value={editTaskTitle}
                        onChange={(e) => setEditTaskTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateTask(task)
                          if (e.key === 'Escape') cancelEditingTask()
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 14,
                          textDecoration: task.is_completed ? 'line-through' : 'none',
                          color: task.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        }}
                      >
                        {task.title}
                      </span>
                    )}
                  </button>

                  {editingTaskId === task.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="btn btn-ghost" style={{ padding: '8px 10px' }} onClick={() => handleUpdateTask(task)}>
                        Save
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '8px 10px' }} onClick={cancelEditingTask}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditingTask(task)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--signal-red)' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTask(task)
                        }}
                      >
                        Delete
                      </button>
                      <span className="tag tag-neutral">{task.category}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title">Activity Heatmap</span>
              <span className="label-eyebrow">LAST 18 WEEKS</span>
            </div>
            <ActivityHeatmap data={heatmapData} />
          </div>
        </div>

        <div>
          <div className="panel section-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="section-card-header" style={{ width: '100%' }}>
              <span className="section-card-title">Placement Readiness</span>
            </div>
            <ReadinessGauge score={readiness.overall} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20, justifyContent: 'center' }}>
              {Object.entries(readiness.breakdown).map(([key, val]) => (
                <span key={key} className="tag tag-neutral">
                  {key}: {val}%
                </span>
              ))}
            </div>
          </div>

          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="var(--signal-amber)" />
                Quest Center
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Level {profile?.level || 1}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {profile?.level >= 5 ? 'PLACEMENT READY 🚀' : profile?.level >= 4 ? 'ALGORITHM MASTER 🧠' : profile?.level >= 3 ? 'CODE WARRIOR ⚔️' : profile?.level >= 2 ? 'APPRENTICE 🛡️' : 'NOVICE ⚔️'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 4 }} title={`${profile?.hearts || 3} Hearts remaining. Keep your streak to preserve them!`}>
                  {Array.from({ length: 3 }).map((_, idx) => {
                    const active = idx < (profile?.hearts !== undefined ? profile.hearts : 3)
                    return <Heart key={idx} size={18} fill={active ? 'var(--signal-red)' : 'transparent'} color={active ? 'var(--signal-red)' : 'var(--border-active)'} style={{ filter: active ? 'drop-shadow(0 0 2px var(--signal-red))' : 'none' }} />
                  })}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>XP PROGRESS</span>
                  <span style={{ color: 'var(--text-primary)' }}>{(profile?.xp || 0) % 100} / 100</span>
                </div>
                <div className="progress-track" aria-label="XP progress" style={{ height: 6 }}>
                  <div className="progress-fill" style={{ width: `${(profile?.xp || 0) % 100}%`, background: 'var(--signal-teal)' }} />
                </div>
              </div>

              <div style={{ background: 'var(--bg-panel-raised)', padding: 12, borderRadius: 8, border: '1px dashed var(--border-active)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  <Trophy size={14} color="var(--signal-amber)" />
                  Daily Quest
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Complete at least 2 daily tasks today.
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                  <span>Progress</span>
                  <span>{completedToday} / 2 completed</span>
                </div>
                <div className="progress-track" style={{ height: 4, marginBottom: 12 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(100, (completedToday / 2) * 100)}%`, background: 'var(--signal-amber)' }} />
                </div>

                {profile?.last_quest_date === todayStr() && profile?.daily_quest_completed ? (
                  <button className="btn btn-ghost" disabled style={{ width: '100%', fontSize: 12, padding: '6px' }}>
                    Quest Claimed 🎉 (+25 XP, +1 ❤️)
                  </button>
                ) : (completedToday >= 2) ? (
                  <button className="btn btn-primary" onClick={handleClaimQuest} style={{ width: '100%', fontSize: 12, padding: '6px', cursor: 'pointer' }}>
                    Claim Quest Reward!
                  </button>
                ) : (
                  <button className="btn btn-ghost" disabled style={{ width: '100%', fontSize: 12, padding: '6px' }}>
                    Quest In Progress...
                  </button>
                )}
              </div>

              {profile?.badges && profile.badges.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={12} /> Achievements
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {profile.badges.map((badge, idx) => (
                      <span key={idx} className="tag tag-amber" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12 }}>
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title">Upcoming Goals</span>
              <button className="btn btn-ghost" onClick={() => setShowGoalModal(true)}>
                <Plus size={16} />
              </button>
            </div>

            {goals.length === 0 ? (
              <EmptyState icon={Target} title="No goals yet" copy="Set a target so progress has a direction." />
            ) : (
              goals.map((goal) => (
                <div className="list-row" key={goal.id}>
                  <button
                    onClick={async () => {
                      await toggleGoal(goal.id, true)
                      setGoals((prev) => prev.filter((g) => g.id !== goal.id))
                      await awardXP(user.id, 20, 'Goal Completed')
                      const updatedProfile = await getProfile(user.id)
                      setProfile(updatedProfile)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      color: 'inherit',
                    }}
                  >
                    <Target size={14} color="var(--signal-amber)" />
                    <span style={{ fontSize: 13 }}>{goal.title}</span>
                  </button>

                  {goal.target_date && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {new Date(goal.target_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showTaskModal && (
        <Modal title="Add today's task" onClose={() => setShowTaskModal(false)}>
          <form className="form-grid" onSubmit={handleAddTask}>
            <input
              className="input"
              autoFocus
              placeholder="e.g. Solve 2 Sliding Window problems"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add task</button>
            </div>
          </form>
        </Modal>
      )}

      {showGoalModal && (
        <Modal title="Add a goal" onClose={() => setShowGoalModal(false)}>
          <form className="form-grid" onSubmit={handleAddGoal}>
            <input
              className="input"
              autoFocus
              placeholder="e.g. Finish Graph topic"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
            />
            <input
              className="input"
              type="date"
              value={newGoalDate}
              onChange={(e) => setNewGoalDate(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowGoalModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add goal</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

