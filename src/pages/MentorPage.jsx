import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Sparkles, Brain, Calendar, Loader2, ChevronDown, ChevronUp, Edit, Trash2, X, Check, Clock } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import { getMentorReviews, getTodayMentorReview, upsertMentorReview, deleteMentorReview } from '../lib/api/mentor'
import { getTasksByDate } from '../lib/api/tasks'
import { getDsaTopics } from '../lib/api/dsa'
import { getJournalEntryByDate } from '../lib/api/journal'
import { loadAiSettings, getProfile } from '../lib/api/profile'
import { generateAIResponse } from '../lib/aiProvider'
import { getLocalYYYYMMDD } from '../lib/supabaseClient'
import './MentorPage.css'

const today = () => getLocalYYYYMMDD()
const BLANK = { what_did_today: '', biggest_achievement: '', time_wasters: '' }

export default function MentorPage() {
  const { user } = useAuth()
  const activeUserId = user?.id || 'anon'
  
  const [history, setHistory] = useState([])
  const [todayReview, setTodayReview] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [aiSettings, setAiSettings] = useState({ provider: 'none', apiKey: '' })
  const [generating, setGenerating] = useState(false)
  const [successToast, setSuccessToast] = useState('')

  // Expandable History States
  const [expandedReviewId, setExpandedReviewId] = useState(null)

  // Editing History States
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editWhatDidToday, setEditWhatDidToday] = useState('')
  const [editBiggestAchievement, setEditBiggestAchievement] = useState('')
  const [editTimeWasters, setEditTimeWasters] = useState('')
  const [editFeedback, setEditFeedback] = useState('')
  const [editImprovement, setEditImprovement] = useState('')
  const [editTomorrowPlan] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isRegeneratingPast, setIsRegeneratingPast] = useState(false)

  const load = useCallback(async () => {
    const [hist, tReview, settings] = await Promise.all([
      getMentorReviews(activeUserId, { limit: 100 }),
      getTodayMentorReview(activeUserId, today()),
      loadAiSettings(activeUserId),
    ])
    // Sort history by date descending
    setHistory(hist.sort((a, b) => b.review_date.localeCompare(a.review_date)))
    setAiSettings(settings)
    if (tReview) {
      setTodayReview(tReview)
      setForm({
        what_did_today: tReview.what_did_today || '',
        biggest_achievement: tReview.biggest_achievement || '',
        time_wasters: tReview.time_wasters || '',
      })
    }
  }, [activeUserId])

  useEffect(() => { load() }, [load])

  // Triggers visual toasts
  const triggerToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Generates or Regenerates the AI review for TODAY
  const handleGenerate = async (e) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const [tasks, topics, journalToday, profile] = await Promise.all([
        getTasksByDate(activeUserId, today()),
        getDsaTopics(activeUserId),
        getJournalEntryByDate(activeUserId, today()),
        getProfile(activeUserId),
      ])
      const tasksCompleted = tasks.filter((t) => t.is_completed).length
      const totalTasks = tasks.length
      const weakAreas = topics.filter((t) => t.weak_areas).map((t) => t.weak_areas)
      const studyHours = journalToday?.study_hours || 0
      const streak = profile?.streak_count || 0

      const feedbackPrompt = `Based on this daily log — what I did: "${form.what_did_today}", biggest achievement: "${form.biggest_achievement}", time wasters: "${form.time_wasters}", tasks completed: ${tasksCompleted}/${totalTasks} — give short, direct mentor-style feedback (3-4 sentences) for an MCA student preparing for placements.`
      const improvementPrompt = `Given these weak areas: ${weakAreas.join(', ') || 'none flagged yet'}, suggest one concrete improvement focus for tomorrow, 2 sentences max.`
      const planPrompt = `Suggest a focused tomorrow study plan (DSA, English, project work, interview prep) in 2-3 sentences for an MCA placement-prep student.`

      const [feedback, improvement, plan] = await Promise.all([
        generateAIResponse(feedbackPrompt, {
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          fallbackType: 'mentor_feedback',
          fallbackContext: { studyHours, tasksCompleted, totalTasks, streak },
        }),
        generateAIResponse(improvementPrompt, {
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          fallbackType: 'mentor_improvement_suggestions',
          fallbackContext: { weakAreas },
        }),
        generateAIResponse(planPrompt, { provider: aiSettings.provider, apiKey: aiSettings.apiKey, fallbackType: 'mentor_tomorrow_plan' }),
      ])

      const saved = await upsertMentorReview(activeUserId, {
        review_date: today(),
        ...form,
        ai_feedback: feedback.text,
        improvement_suggestions: improvement.text,
        tomorrow_plan: plan.text,
        generated_by: feedback.provider,
      })
      
      setTodayReview(saved)
      setHistory((prev) => [saved, ...prev.filter((h) => h.review_date !== today())].sort((a, b) => b.review_date.localeCompare(a.review_date)))
      triggerToast("Tonight's review saved!")
    } catch (err) {
      console.error('Failed to generate review', err)
    } finally {
      setGenerating(false)
    }
  }

  // Edit / Update / Delete handlers for history logs
  const handleStartEdit = (log) => {
    setEditingReviewId(log.id)
    setEditWhatDidToday(log.what_did_today || '')
    setEditBiggestAchievement(log.biggest_achievement || '')
    setEditTimeWasters(log.time_wasters || '')
    setEditFeedback(log.ai_feedback || '')
    setEditImprovement(log.improvement_suggestions || '')
  }

  const handleCancelEdit = () => {
    setEditingReviewId(null)
    setEditWhatDidToday('')
    setEditBiggestAchievement('')
    setEditTimeWasters('')
    setEditFeedback('')
    setEditImprovement('')
  }

  const handleSaveUpdate = async (e, log) => {
    e.preventDefault()
    setIsUpdating(true)
    try {
      const updated = await upsertMentorReview(activeUserId, {
        ...log,
        what_did_today: editWhatDidToday,
        biggest_achievement: editBiggestAchievement,
        time_wasters: editTimeWasters,
        ai_feedback: editFeedback,
        improvement_suggestions: editImprovement
      })

      setHistory((prev) => prev.map((h) => (h.id === log.id ? updated : h)))
      if (log.review_date === today()) {
        setTodayReview(updated)
        setForm({
          what_did_today: editWhatDidToday,
          biggest_achievement: editBiggestAchievement,
          time_wasters: editTimeWasters
        })
      }
      handleCancelEdit()
      triggerToast('Review updated!')
    } catch (err) {
      console.error('Failed to update review:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRegeneratePastReview = async (log) => {
    setIsRegeneratingPast(true)
    try {
      // Prompt values derived from current edit draft states
      const feedbackPrompt = `Based on this daily log — what I did: "${editWhatDidToday}", biggest achievement: "${editBiggestAchievement}", time wasters: "${editTimeWasters}" — give short, direct mentor-style feedback (3-4 sentences) for an MCA student preparing for placements.`
      const improvementPrompt = `Suggest one concrete improvement focus based on these time wasters: "${editTimeWasters}". Keep it to 1-2 sentences.`
      const planPrompt = `Suggest a tomorrow study plan in 2 sentences for placement preparation.`

      const [feedback, improvement, plan] = await Promise.all([
        generateAIResponse(feedbackPrompt, {
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          fallbackType: 'mentor_feedback',
          fallbackContext: { studyHours: 2, tasksCompleted: 2, totalTasks: 3, streak: 5 },
        }),
        generateAIResponse(improvementPrompt, {
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          fallbackType: 'mentor_improvement_suggestions',
          fallbackContext: { weakAreas: [] },
        }),
        generateAIResponse(planPrompt, { provider: aiSettings.provider, apiKey: aiSettings.apiKey, fallbackType: 'mentor_tomorrow_plan' }),
      ])

      setEditFeedback(feedback.text)
      setEditImprovement(improvement.text)
      triggerToast('AI review regenerated!')
    } catch (err) {
      console.error('Failed to regenerate review:', err)
    } finally {
      setIsRegeneratingPast(false)
    }
  }

  const handleDelete = async (log) => {
    if (!window.confirm(`Are you sure you want to delete the review for ${log.review_date}?`)) return
    try {
      await deleteMentorReview(activeUserId, log.id)
      setHistory((prev) => prev.filter((h) => h.id !== log.id))
      
      if (log.review_date === today()) {
        setTodayReview(null)
        setForm(BLANK)
      }
      if (expandedReviewId === log.id) setExpandedReviewId(null)
      triggerToast('Review deleted!')
    } catch (err) {
      console.error('Failed to delete review:', err)
    }
  }

  const toggleExpandCard = (id) => {
    if (editingReviewId && editingReviewId !== id) {
      if (!window.confirm('Discard unsaved edit changes?')) return
      handleCancelEdit()
    }
    setExpandedReviewId(expandedReviewId === id ? null : id)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Mentor</h1>
          <p className="page-subtitle">Nightly review — log today, get direct feedback and a plan for tomorrow</p>
        </div>
      </div>

      <div className="grid-2col">
        {/* tonight's review */}
        <div className="panel section-card">
          <div className="section-card-header">
            <span className="section-card-title">Tonight's review</span>
            <span className="tag tag-neutral" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} /> {today()}
            </span>
          </div>
          <form className="form-grid" onSubmit={handleGenerate}>
            <div>
              <label className="label-eyebrow">What did you actually do today?</label>
              <textarea
                className="input" rows={3} style={{ marginTop: 4 }} placeholder="e.g. Completed 3 LinkedList problems, revised OOPs inheritance, finalized resume drafts."
                required
                value={form.what_did_today}
                onChange={(e) => setForm({ ...form, what_did_today: e.target.value })}
              />
            </div>
            
            <div>
              <label className="label-eyebrow">Biggest achievement today</label>
              <textarea
                className="input" rows={2} style={{ marginTop: 4 }} placeholder="e.g. Solved a hard LeetCode problem independently."
                value={form.biggest_achievement}
                onChange={(e) => setForm({ ...form, biggest_achievement: e.target.value })}
              />
            </div>
            
            <div>
              <label className="label-eyebrow">Where did time get wasted?</label>
              <textarea
                className="input" rows={2} style={{ marginTop: 4 }} placeholder="e.g. Spent too much time scrolling feeds on social media."
                value={form.time_wasters}
                onChange={(e) => setForm({ ...form, time_wasters: e.target.value })}
              />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {generating ? 'Generating review…' : todayReview ? 'Regenerate review' : "Get tonight's feedback"}
            </button>
          </form>
        </div>

        {/* tonight's feedback panel */}
        <div className="panel section-card">
          <div className="section-card-header">
            <span className="section-card-title">Tonight's Feedback</span>
            {todayReview?.generated_by && (
              <span className="tag tag-amber">{todayReview.generated_by === 'rule_based' ? 'Rule-based' : todayReview.generated_by}</span>
            )}
          </div>
          {!todayReview ? (
            <EmptyState icon={Brain} title="No review yet today" copy="Fill in tonight's review on the left to get feedback, focus areas, and a plan for tomorrow." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <span className="label-eyebrow">Feedback</span>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 6, color: 'var(--text-secondary)' }}>{todayReview.ai_feedback}</p>
              </div>
              <div>
                <span className="label-eyebrow">Focus area</span>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 6, color: 'var(--text-secondary)' }}>{todayReview.improvement_suggestions}</p>
              </div>
              <div>
                <span className="label-eyebrow">Tomorrow's plan</span>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 6, color: 'var(--text-secondary)' }}>{todayReview.tomorrow_plan}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review History collapsible accordion timeline */}
      <div className="panel section-card" style={{ marginTop: 24 }}>
        <div className="section-card-header">
          <span className="section-card-title">Review History</span>
          <span className="label-eyebrow">{history.length} logged</span>
        </div>

        {history.length === 0 ? (
          <EmptyState icon={Calendar} title="No history yet" copy="Past reviews will show up here once you start logging nightly." />
        ) : (
          <div className="history-timeline">
            {history.map((h) => {
              const isExpanded = expandedReviewId === h.id
              const isEditing = editingReviewId === h.id
              
              return (
                <div key={h.id} className={`timeline-card ${isExpanded ? 'is-expanded' : ''}`}>
                  {/* Card Header */}
                  <div className="timeline-card-header" onClick={() => toggleExpandCard(h.id)}>
                    <div className="timeline-card-summary">
                      <span className="timeline-card-date">
                        {new Date(h.review_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {h.review_date === today() && (
                          <span className="tag tag-teal" style={{ marginLeft: 8, padding: '1px 6px', fontSize: 10 }}>Today</span>
                        )}
                      </span>
                      <span className="timeline-card-preview">{h.ai_feedback}</span>
                    </div>
                    <div className="timeline-card-indicators">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Collapsible Details Body */}
                  {isExpanded && (
                    <>
                      {isEditing ? (
                        <form onSubmit={(e) => handleSaveUpdate(e, h)} className="edit-review-form form-grid">
                          <div>
                            <label className="label-eyebrow">What did you actually do today?</label>
                            <textarea
                              className="input"
                              rows={3}
                              value={editWhatDidToday}
                              onChange={(e) => setEditWhatDidToday(e.target.value)}
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="label-eyebrow">Biggest achievement today</label>
                            <textarea
                              className="input"
                              rows={2}
                              value={editBiggestAchievement}
                              onChange={(e) => setEditBiggestAchievement(e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="label-eyebrow">Where did time get wasted?</label>
                            <textarea
                              className="input"
                              rows={2}
                              value={editTimeWasters}
                              onChange={(e) => setEditTimeWasters(e.target.value)}
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <label className="label-eyebrow" style={{ marginBottom: 0 }}>AI Feedback text</label>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '2px 8px', fontSize: 11, display: 'inline-flex', gap: 4, height: 'auto', border: '1px solid var(--border-hairline)' }}
                                onClick={() => handleRegeneratePastReview(h)}
                                disabled={isRegeneratingPast}
                              >
                                {isRegeneratingPast ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                                {isRegeneratingPast ? 'Regenerating...' : 'Regenerate feedback'}
                              </button>
                            </div>
                            <textarea
                              className="input"
                              rows={3}
                              value={editFeedback}
                              onChange={(e) => setEditFeedback(e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="label-eyebrow">Improvement / Focus Area</label>
                            <textarea
                              className="input"
                              rows={2}
                              value={editImprovement}
                              onChange={(e) => setEditImprovement(e.target.value)}
                            />
                          </div>

                          <div className="modal-actions" style={{ marginTop: 8 }}>
                            <button type="button" className="btn btn-ghost" onClick={handleCancelEdit}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={isUpdating}>
                              {isUpdating ? 'Saving...' : 'Save changes'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="timeline-card-body">
                          {/* Log details */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: 'var(--bg-panel-raised)', padding: 12, borderRadius: 'var(--r-md)' }}>
                            <div className="timeline-card-section">
                              <span className="label-eyebrow" style={{ fontSize: 9.5 }}>What was done</span>
                              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{h.what_did_today || '—'}</span>
                            </div>
                            <div className="timeline-card-section">
                              <span className="label-eyebrow" style={{ fontSize: 9.5 }}>Achievement</span>
                              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{h.biggest_achievement || '—'}</span>
                            </div>
                            <div className="timeline-card-section">
                              <span className="label-eyebrow" style={{ fontSize: 9.5 }}>Time wasted</span>
                              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{h.time_wasters || '—'}</span>
                            </div>
                          </div>

                          {/* Coach output details */}
                          <div className="timeline-card-section">
                            <span className="label-eyebrow">Feedback</span>
                            <p className="timeline-section-text">{h.ai_feedback}</p>
                          </div>
                          
                          <div className="timeline-card-section">
                            <span className="label-eyebrow">Focus area</span>
                            <p className="timeline-section-text">{h.improvement_suggestions}</p>
                          </div>

                          <div className="timeline-card-section">
                            <span className="label-eyebrow">Tomorrow's plan</span>
                            <p className="timeline-section-text">{h.tomorrow_plan}</p>
                          </div>

                          <div className="timeline-card-section" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            <Clock size={12} />
                            <span>Generated by {h.generated_by === 'rule_based' ? 'Rule Engine' : h.generated_by}</span>
                          </div>

                          {/* Action Drawer */}
                          <div className="timeline-actions">
                            <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleStartEdit(h)}>
                              <Edit size={12} /> Edit
                            </button>
                            <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--signal-red)' }} onClick={() => handleDelete(h)}>
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating success toast notifications */}
      {successToast && (
        <div className="tag tag-teal" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10000, padding: '12px 20px', fontSize: 13, border: '1px solid var(--border-active)', boxShadow: 'var(--shadow-raised)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={16} />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  )
}
