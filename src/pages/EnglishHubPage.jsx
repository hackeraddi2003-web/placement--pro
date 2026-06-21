import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Mic, PenLine, Sparkles, TrendingUp, Scale } from 'lucide-react'

import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import { getEnglishLogs, addEnglishLog } from '../lib/api/english'
import { loadAiSettings } from '../lib/api/profile'
import { generateAIResponse } from '../lib/aiProvider'

const ensureArray = (v) => (Array.isArray(v) ? v : [])


const TASK_TYPES = [
  { key: 'speak_topic', label: 'Speak on a topic', fallback: 'english_task_speak_topic' },
  { key: 'describe_project', label: 'Describe a project', fallback: 'english_task_describe_project' },
  { key: 'explain_dsa', label: 'Explain a LeetCode problem', fallback: 'english_task_explain_dsa' },
  { key: 'hr_practice', label: 'HR interview practice', fallback: 'english_task_hr_practice' },
]

export default function EnglishHubPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [aiSettings, setAiSettings] = useState({ provider: 'none', apiKey: '' })
  const [activeTask, setActiveTask] = useState(null)
  const [taskPrompt, setTaskPrompt] = useState('')
  const [loadingTask, setLoadingTask] = useState(false)
  const [response, setResponse] = useState('')
  const [confidence, setConfidence] = useState(5)
  const [minutes, setMinutes] = useState(2)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const [logData, settings] = await Promise.all([
      getEnglishLogs(user.id, { limit: 50 }),
      loadAiSettings(user.id),
    ])
    setLogs(logData)
    setAiSettings(settings)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleStartTask = async (task) => {
    setActiveTask(task)
    setLoadingTask(true)
    setResponse('')
    try {
      const result = await generateAIResponse(
        `Generate one short English speaking/writing practice task of type "${task.label}" for an MCA student preparing for placements. Keep it to 1-2 sentences.`,
        { provider: aiSettings.provider, apiKey: aiSettings.apiKey, fallbackType: task.fallback }
      )
      setTaskPrompt(result.text)
    } finally {
      setLoadingTask(false)
    }
  }

  const handleSaveLog = async (e) => {
    e.preventDefault()
    if (!activeTask) return
    setSaving(true)
    try {
      // Lightweight heuristic extraction (works with rule-based and AI providers).
      // Ensures english_logs.vocab_words and english_logs.grammar_mistakes get populated.
      const text = `${taskPrompt || ''}\n${response || ''}`.toLowerCase()
      const vocabCandidates = Array.from(
        new Set(
          text
            .replace(/[^a-z\s']/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 5)
        )
      ).slice(0, 20)

      // Grammar mistakes heuristic: count common error patterns.
      const grammarMistakes = []
      if (/\b(i am|im)\b.*\b(i|a)\b/.test(text)) grammarMistakes.push('possible tense/usage issue')
      if (/\bthere is\b.*\b(these|they)\b/.test(text)) grammarMistakes.push('subject-verb agreement')
      if (/\bdoesnt\b|\bdont\b/.test(text)) grammarMistakes.push('negative form')
      if (/\bvery\b.*\bvery\b/.test(text)) grammarMistakes.push('repetition')
      if (grammarMistakes.length === 0) grammarMistakes.push('—')

      const created = await addEnglishLog(user.id, {
        task_type: activeTask.key,
        task_prompt: taskPrompt,
        task_response: response,
        ai_feedback: '',
        vocab_words: vocabCandidates,
        grammar_mistakes: grammarMistakes,
        confidence_score: confidence,
        speaking_minutes: activeTask.key !== 'hr_practice' ? minutes : 0,
        writing_minutes: 0,
      })

      setLogs((prev) => [created, ...prev])
      setActiveTask(null)
      setTaskPrompt('')
      setResponse('')
    } finally {
      setSaving(false)
    }
  }

  const totalSpeaking = logs.reduce((s, l) => s + (l.speaking_minutes || 0), 0)
  const avgConfidence = logs.length
    ? (logs.reduce((s, l) => s + (l.confidence_score || 0), 0) / logs.length).toFixed(1)
    : '—'
  const totalVocab = logs.reduce((s, l) => s + (Array.isArray(l.vocab_words) ? l.vocab_words.length : 0), 0)
  const totalGrammar = logs.reduce((s, l) => s + (Array.isArray(l.grammar_mistakes) ? l.grammar_mistakes.length : 0), 0)


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">English Communication Hub</h1>
          <p className="page-subtitle">
            Daily speaking practice compounds fast. {aiSettings.provider === 'none' && 'Using rule-based tasks — add an AI key in Settings for generated ones.'}
          </p>
        </div>
      </div>

      <div className="grid-stats">
        <StatCard icon={Mic} label="Speaking minutes (total)" value={totalSpeaking} accent="amber" />
        <StatCard icon={TrendingUp} label="Avg confidence" value={`${avgConfidence}/10`} accent="teal" />
        <StatCard icon={PenLine} label="Vocab words logged" value={totalVocab} accent="violet" />
        <StatCard icon={TrendingUp} label="Grammar mistakes logged" value={totalGrammar} accent="red" />

        <StatCard icon={Sparkles} label="Sessions logged" value={logs.length} accent="red" />
      </div>

      <div className="grid-2col">
        <div>

          <div>
            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">Today's practice tasks</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TASK_TYPES.map((t) => (
                  <button key={t.key} className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => handleStartTask(t)}>
                    <Mic size={16} /> {t.label}
                  </button>
                ))}
              </div>

              {activeTask && (
                <form onSubmit={handleSaveLog} className="form-grid" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-hairline)' }}>
                  <div>
                    <label className="label-eyebrow">Task</label>
                    <p style={{ fontSize: 14, marginTop: 6 }}>{loadingTask ? 'Generating…' : taskPrompt}</p>
                  </div>
                  <div>
                    <label className="label-eyebrow">Your response / summary (after speaking out loud)</label>
                    <textarea className="input" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write 2-3 sentences summarizing what you said…" />
                  </div>
                  <div className="form-row-2">
                    <div>
                      <label className="label-eyebrow">Minutes spent</label>
                      <input className="input" type="number" min="0" value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="label-eyebrow">Self-rated confidence (1-10)</label>
                      <input className="input" type="number" min="1" max="10" value={confidence} onChange={(e) => setConfidence(parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                  <div className="modal-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setActiveTask(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving || loadingTask}>{saving ? 'Saving…' : 'Log session'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div>
            <div className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">History</span>
              </div>
              {logs.length === 0 ? (
                <EmptyState icon={Mic} title="No sessions yet" copy="Start your first speaking task to build the trend line." />
              ) : (
                <div className="timeline-list">
                  {logs.slice(0, 20).map((log) => (
                    <div key={log.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{log.task_prompt || log.task_type}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {log.speaking_minutes}min
                        </div>
                      </div>
                      <span className="tag tag-amber">{log.confidence_score}/10</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

