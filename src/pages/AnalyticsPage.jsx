import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getLocalYYYYMMDD } from '../lib/supabaseClient'
import { BarChart3, Calendar, Clock, Flame, Code2, MessageCircle } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import { getJournalEntries } from '../lib/api/journal'
import { getEnglishLogs } from '../lib/api/english'
import { getDsaTopics, getDsaProblems } from '../lib/api/dsa'
import { getProjects } from '../lib/api/projects'
import { getSubjectProgress } from '../lib/api/skills'
import { getInterviewQuestions } from '../lib/api/interview'
import { getProfile } from '../lib/api/profile'
import { calculateReadinessScore } from '../lib/readinessScore'

const COLOR = {
  amber: '#ff8a1f',
  teal: '#2dd4bf',
  red: '#f0566b',
  violet: '#8b7cf6',
  grid: '#232a36',
  textSecondary: '#9aa4b5',
}

const fmtDay = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [range, setRange] = useState('weekly') // 'weekly' | 'monthly'
  const [loading, setLoading] = useState(true)
  const [journal, setJournal] = useState([])
  const [english, setEnglish] = useState([])
  const [dsaTopics, setDsaTopics] = useState([])
  const [dsaProblems, setDsaProblems] = useState([])
  const [projects, setProjects] = useState([])
  const [subjects, setSubjects] = useState([])
  const [interviewQs, setInterviewQs] = useState([])
  const [streak, setStreak] = useState(0)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        getJournalEntries(user.id, { limit: 90 }),
        getEnglishLogs(user.id, { limit: 90 }),
        getDsaTopics(user.id),
        getDsaProblems(user.id),
        getProjects(user.id),
        getSubjectProgress(user.id),
        getInterviewQuestions(user.id),
        getProfile(user.id),
      ])
      const [j, e, topics, problems, proj, subj, iq, profile] = results.map(
        (r) => (r.status === 'fulfilled' ? r.value : null)
      )
      setJournal(Array.isArray(j) ? j : [])
      setEnglish(Array.isArray(e) ? e : [])
      setDsaTopics(Array.isArray(topics) ? topics : [])
      setDsaProblems(Array.isArray(problems) ? problems : [])
      setProjects(Array.isArray(proj) ? proj : [])
      setSubjects(Array.isArray(subj) ? subj : [])
      setInterviewQs(Array.isArray(iq) ? iq : [])
      setStreak(profile?.streak_count || 0)
    } catch (err) {
      console.error('[Analytics] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])


  useEffect(() => { load() }, [load])

  const windowDays = range === 'weekly' ? 7 : 30

  // ---- Study consistency (hours per day, recent window) ----
  const consistencyData = useMemo(() => {
    const days = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = getLocalYYYYMMDD(d)
      const entry = journal.find((j) => j.entry_date === iso)
      days.push({ date: iso, label: fmtDay(iso), hours: entry?.study_hours || 0, mood: entry?.mood || null })
    }
    return days
  }, [journal, windowDays])

  // ---- English improvement (confidence score over time) ----
  const englishData = useMemo(() => {
    return [...english]
      .filter((l) => l.log_date)
      .sort((a, b) => new Date(a.log_date) - new Date(b.log_date))
      .slice(-windowDays)
      .map((l) => ({ label: fmtDay(l.log_date), confidence: l.confidence_score || 0, minutes: (l.speaking_minutes || 0) + (l.writing_minutes || 0) }))
  }, [english, windowDays])

  // ---- DSA growth (cumulative problems solved) ----
  const dsaGrowthData = useMemo(() => {
    const sorted = [...dsaProblems]
      .filter((p) => p.solved_date)
      .sort((a, b) => new Date(a.solved_date) - new Date(b.solved_date))
    const cumulative = []
    let count = 0
    const byDate = {}
    sorted.forEach((p) => {
      byDate[p.solved_date] = (byDate[p.solved_date] || 0) + 1
    })
    const dates = Object.keys(byDate).sort()
    dates.forEach((d) => {
      count += byDate[d]
      cumulative.push({ label: fmtDay(d), total: count })
    })
    return cumulative.slice(-windowDays)
  }, [dsaProblems, windowDays])

  // ---- Readiness breakdown (radar) ----
  const readiness = useMemo(() => calculateReadinessScore({
    dsaTopics, projects, subjects, englishLogs: english, interviewQuestions: interviewQs, streak,
  }), [dsaTopics, projects, subjects, english, interviewQs, streak])

  const radarData = useMemo(() => ([
    { area: 'DSA', value: readiness.breakdown.dsa },
    { area: 'Projects', value: readiness.breakdown.projects },
    { area: 'Subjects', value: readiness.breakdown.subjects },
    { area: 'English', value: readiness.breakdown.english },
    { area: 'Interview', value: readiness.breakdown.interview },
    { area: 'Consistency', value: readiness.breakdown.consistency },
  ]), [readiness])

  // ---- Weekly/Monthly summary numbers ----
  const summary = useMemo(() => {
    const totalHours = consistencyData.reduce((s, d) => s + d.hours, 0)
    const activeDays = consistencyData.filter((d) => d.hours > 0).length
    const problemsSolved = dsaProblems.filter((p) => {
      if (!p.solved_date) return false
      const diff = (new Date() - new Date(p.solved_date)) / (1000 * 60 * 60 * 24)
      return diff <= windowDays
    }).length
    const avgConfidence = englishData.length
      ? (englishData.reduce((s, e) => s + e.confidence, 0) / englishData.length).toFixed(1)
      : '—'
    return { totalHours: totalHours.toFixed(1), activeDays, problemsSolved, avgConfidence }
  }, [consistencyData, dsaProblems, englishData, windowDays])

  if (loading) {
    return (
      <div className="panel section-card">
        <EmptyState icon={BarChart3} title="Loading analytics…" copy="Pulling together your journal, DSA, English, and readiness data." />
      </div>
    )
  }

  const hasAnyData = journal.length > 0 || english.length > 0 || dsaProblems.length > 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Trends across study consistency, DSA, English, and overall readiness</p>
        </div>
        <div className="view-toggle">
          <button className={`view-toggle-btn ${range === 'weekly' ? 'is-active' : ''}`} onClick={() => setRange('weekly')}>
            <Calendar size={14} /> Weekly
          </button>
          <button className={`view-toggle-btn ${range === 'monthly' ? 'is-active' : ''}`} onClick={() => setRange('monthly')}>
            <Calendar size={14} /> Monthly
          </button>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="panel section-card">
          <EmptyState icon={BarChart3} title="No data yet" copy="Log a few days of journals, DSA problems, and English sessions to see trends here." />
        </div>
      ) : (
        <>
          <div className="grid-stats" style={{ marginBottom: 20 }}>
            <StatCard icon={Clock} accent="amber" label={`Study hours (last ${windowDays}d)`} value={`${summary.totalHours}h`} />
            <StatCard icon={Flame} accent="teal" label="Active days" value={`${summary.activeDays}/${windowDays}`} />
            <StatCard icon={Code2} accent="violet" label="Problems solved" value={summary.problemsSolved} />
            <StatCard icon={MessageCircle} accent="red" label="Avg. English confidence" value={summary.avgConfidence === '—' ? '—' : `${summary.avgConfidence}/10`} />
          </div>

          <div className="grid-2col" style={{ marginBottom: 20 }}>
            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">Study consistency</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={consistencyData}>
                  <CartesianGrid stroke={COLOR.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={COLOR.textSecondary} fontSize={11} tickLine={false} />
                  <YAxis stroke={COLOR.textSecondary} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#12161d', border: '1px solid #232a36', borderRadius: 8 }} />
                  <Bar dataKey="hours" fill={COLOR.amber} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">Placement readiness breakdown</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={COLOR.grid} />
                  <PolarAngleAxis dataKey="area" stroke={COLOR.textSecondary} fontSize={11} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke={COLOR.grid} fontSize={10} />
                  <Radar dataKey="value" stroke={COLOR.violet} fill={COLOR.violet} fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid-2col">
            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">DSA growth (cumulative)</span>
              </div>
              {dsaGrowthData.length === 0 ? (
                <EmptyState icon={BarChart3} title="No problems logged yet" copy="Add solved problems in the DSA Tracker to see growth here." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dsaGrowthData}>
                    <CartesianGrid stroke={COLOR.grid} vertical={false} />
                    <XAxis dataKey="label" stroke={COLOR.textSecondary} fontSize={11} tickLine={false} />
                    <YAxis stroke={COLOR.textSecondary} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#12161d', border: '1px solid #232a36', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="total" stroke={COLOR.teal} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">English improvement</span>
              </div>
              {englishData.length === 0 ? (
                <EmptyState icon={BarChart3} title="No sessions logged yet" copy="Log a few English Hub sessions to see your confidence trend." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={englishData}>
                    <CartesianGrid stroke={COLOR.grid} vertical={false} />
                    <XAxis dataKey="label" stroke={COLOR.textSecondary} fontSize={11} tickLine={false} />
                    <YAxis stroke={COLOR.textSecondary} fontSize={11} domain={[0, 10]} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#12161d', border: '1px solid #232a36', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="confidence" stroke={COLOR.red} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
