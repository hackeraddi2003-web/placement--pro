import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Sparkles, Brain, Calendar, Loader2 } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import { getMentorReviews, getTodayMentorReview, upsertMentorReview } from '../lib/api/mentor'
import { getTasksByDate } from '../lib/api/tasks'
import { getDsaTopics } from '../lib/api/dsa'
import { getJournalEntryByDate } from '../lib/api/journal'
import { loadAiSettings, getProfile } from '../lib/api/profile'
import { generateAIResponse } from '../lib/aiProvider'


const today = () => new Date().toISOString().slice(0, 10)

const BLANK = { what_did_today: '', biggest_achievement: '', time_wasters: '' }

export default function MentorPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [todayReview, setTodayReview] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [aiSettings, setAiSettings] = useState({ provider: 'none', apiKey: '' })
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const [hist, tReview, settings] = await Promise.all([
      getMentorReviews(user.id, { limit: 30 }),
      getTodayMentorReview(user.id, today()),
      loadAiSettings(user.id),
    ])
    setHistory(hist)
    setAiSettings(settings)
    if (tReview) {
      setTodayReview(tReview)
      setForm({
        what_did_today: tReview.what_did_today || '',
        biggest_achievement: tReview.biggest_achievement || '',
        time_wasters: tReview.time_wasters || '',
      })
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const handleGenerate = async (e) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const [tasks, topics, journalToday, profile] = await Promise.all([
        getTasksByDate(user.id, today()),
        getDsaTopics(user.id),
        getJournalEntryByDate(user.id, today()),
        getProfile(user.id),
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


      const saved = await upsertMentorReview(user.id, {
        review_date: today(),
        ...form,
        ai_feedback: feedback.text,
        improvement_suggestions: improvement.text,
        tomorrow_plan: plan.text,
        generated_by: feedback.provider,
      })
      setTodayReview(saved)
      setHistory((prev) => [saved, ...prev.filter((h) => h.review_date !== today())])
    } finally {
      setGenerating(false)
    }
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
        <div className="panel section-card">
          <div className="section-card-header">
            <span className="section-card-title">Tonight's review</span>
            <span className="tag tag-neutral" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} /> {today()}
            </span>
          </div>
          <form className="form-grid" onSubmit={handleGenerate}>
            <textarea
              className="input" rows={3} placeholder="What did you actually do today?"
              value={form.what_did_today}
              onChange={(e) => setForm({ ...form, what_did_today: e.target.value })}
            />
            <textarea
              className="input" rows={2} placeholder="Biggest achievement today"
              value={form.biggest_achievement}
              onChange={(e) => setForm({ ...form, biggest_achievement: e.target.value })}
            />
            <textarea
              className="input" rows={2} placeholder="Where did time get wasted?"
              value={form.time_wasters}
              onChange={(e) => setForm({ ...form, time_wasters: e.target.value })}
            />
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {generating ? 'Generating review…' : todayReview ? 'Regenerate review' : 'Get tonight\'s feedback'}
            </button>
          </form>
        </div>

        <div className="panel section-card">
          <div className="section-card-header">
            <span className="section-card-title">Mentor feedback</span>
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
                <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 6 }}>{todayReview.ai_feedback}</p>
              </div>
              <div>
                <span className="label-eyebrow">Focus area</span>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 6 }}>{todayReview.improvement_suggestions}</p>
              </div>
              <div>
                <span className="label-eyebrow">Tomorrow's plan</span>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 6 }}>{todayReview.tomorrow_plan}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel section-card" style={{ marginTop: 20 }}>
        <div className="section-card-header">
          <span className="section-card-title">Review history</span>
          <span className="tag tag-neutral">{history.length} entries</span>
        </div>
        {history.length === 0 ? (
          <EmptyState icon={Calendar} title="No history yet" copy="Past reviews will show up here once you start logging nightly." />
        ) : (
          history.map((h) => (
            <div key={h.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{h.review_date}</span>
              <span style={{ fontSize: 13 }}>{h.ai_feedback}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
