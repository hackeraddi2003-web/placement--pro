import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Mic, PenLine, Sparkles, TrendingUp, Scale, Upload, Edit, Trash2, ChevronDown, ChevronUp, Check, X, BookOpen } from 'lucide-react'

import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import { getEnglishLogs, addEnglishLog, updateEnglishLog, deleteEnglishLog } from '../lib/api/english'
import { loadAiSettings } from '../lib/api/profile'
import { generateAIResponse } from '../lib/aiProvider'
import './EnglishHubPage.css'

const ensureArray = (v) => (Array.isArray(v) ? v : [])

const TASK_TYPES = [
  { key: 'speak_topic', label: 'Speak on a topic', fallback: 'english_task_speak_topic', desc: 'Speak out loud for 2 minutes and write a summary.' },
  { key: 'describe_project', label: 'Describe a project', fallback: 'english_task_describe_project', desc: 'Practice answering project questions in mock interviews.' },
  { key: 'explain_dsa', label: 'Explain LeetCode solutions', fallback: 'english_task_explain_dsa', desc: 'Practice explaining algorithms clearly to interviewers.' },
  { key: 'hr_practice', label: 'HR interview questions', fallback: 'english_task_hr_practice', desc: 'Practice behavioral and HR questions in under 90 seconds.' },
]

// Reusable logic to parse vocabulary words and simple grammar rules based on log context
function computeVocabAndGrammar(prompt, response) {
  const text = `${prompt || ''}\n${response || ''}`.toLowerCase()
  const vocabCandidates = Array.from(
    new Set(
      text
        .replace(/[^a-z\s']/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 5)
    )
  ).slice(0, 20)

  const grammarMistakes = []
  if (/\b(i am|im)\b.*\b(i|a)\b/.test(text)) grammarMistakes.push('possible tense/usage issue')
  if (/\bthere is\b.*\b(these|they)\b/.test(text)) grammarMistakes.push('subject-verb agreement')
  if (/\bdoesnt\b|\bdont\b/.test(text)) grammarMistakes.push('negative form')
  if (/\bvery\b.*\bvery\b/.test(text)) grammarMistakes.push('repetition')
  if (grammarMistakes.length === 0) grammarMistakes.push('—')

  return { vocabCandidates, grammarMistakes }
}

export default function EnglishHubPage() {
  const { user } = useAuth()
  const activeUserId = user?.id || 'anon'
  
  const [logs, setLogs] = useState([])
  const [aiSettings, setAiSettings] = useState({ provider: 'none', apiKey: '' })
  
  // Practice Wizard States
  const [activeTask, setActiveTask] = useState(null)
  const [taskPrompt, setTaskPrompt] = useState('')
  const [loadingTask, setLoadingTask] = useState(false)
  const [response, setResponse] = useState('')
  const [confidence, setConfidence] = useState(5)
  const [minutes, setMinutes] = useState(2)
  const [saving, setSaving] = useState(false)

  // Expandable History States
  const [expandedLogId, setExpandedLogId] = useState(null)
  
  // Inline Edit States
  const [editingLogId, setEditingLogId] = useState(null)
  const [editResponse, setEditResponse] = useState('')
  const [editMinutes, setEditMinutes] = useState(0)
  const [editConfidence, setEditConfidence] = useState(5)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    const [logData, settings] = await Promise.all([
      getEnglishLogs(activeUserId, { limit: 100 }),
      loadAiSettings(activeUserId),
    ])
    setLogs(logData)
    setAiSettings(settings)
  }, [activeUserId])

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

  const handleImportTextFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      setResponse(evt.target.result || '')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSaveLog = async (e) => {
    e.preventDefault()
    if (!activeTask) return
    setSaving(true)
    try {
      const { vocabCandidates, grammarMistakes } = computeVocabAndGrammar(taskPrompt, response)

      const created = await addEnglishLog(activeUserId, {
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

  // Edit / Update / Delete Handlers
  const startEdit = (log) => {
    setEditingLogId(log.id)
    setEditResponse(log.task_response || '')
    setEditMinutes(log.speaking_minutes || 0)
    setEditConfidence(log.confidence_score || 5)
  }

  const cancelEdit = () => {
    setEditingLogId(null)
    setEditResponse('')
    setEditMinutes(0)
    setEditConfidence(5)
  }

  const handleUpdateLog = async (e, log) => {
    e.preventDefault()
    setUpdating(true)
    try {
      const { vocabCandidates, grammarMistakes } = computeVocabAndGrammar(log.task_prompt, editResponse)

      const updated = await updateEnglishLog(activeUserId, {
        ...log,
        task_response: editResponse,
        speaking_minutes: parseInt(editMinutes) || 0,
        confidence_score: parseInt(editConfidence) || 1,
        vocab_words: vocabCandidates,
        grammar_mistakes: grammarMistakes,
      })

      setLogs((prev) => prev.map((l) => (l.id === log.id ? updated : l)))
      cancelEdit()
    } catch (err) {
      console.error('[EnglishHubPage] Update failed', err)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Are you sure you want to delete this practice session?')) return
    try {
      await deleteEnglishLog(id)
      setLogs((prev) => prev.filter((l) => l.id !== id))
      if (expandedLogId === id) setExpandedLogId(null)
      if (editingLogId === id) cancelEdit()
    } catch (err) {
      console.error('[EnglishHubPage] Delete failed', err)
    }
  }

  const toggleExpandLog = (id) => {
    if (editingLogId && editingLogId !== id) {
      if (!window.confirm('Discard unsaved changes?')) return
      cancelEdit()
    }
    setExpandedLogId(expandedLogId === id ? null : id)
  }

  // Statistical calculations
  const totalSpeaking = logs.reduce((s, l) => s + (l.speaking_minutes || 0), 0)
  const avgConfidence = logs.length
    ? (logs.reduce((s, l) => s + (l.confidence_score || 0), 0) / logs.length).toFixed(1)
    : '—'
  const totalVocab = logs.reduce((s, l) => s + (ensureArray(l.vocab_words).length), 0)
  const totalGrammar = logs.reduce((s, l) => s + (ensureArray(l.grammar_mistakes).filter(m => m !== '—').length), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">English Communication Hub</h1>
          <p className="page-subtitle">
            Daily verbal & written practice builds interview fluency. {aiSettings.provider === 'none' && 'Running offline fallback logs.'}
          </p>
        </div>
      </div>

      <div className="grid-stats">
        <StatCard icon={Mic} label="Speaking minutes (total)" value={`${totalSpeaking}m`} accent="amber" />
        <StatCard icon={TrendingUp} label="Avg confidence" value={`${avgConfidence}/10`} accent="teal" />
        <StatCard icon={BookOpen} label="Vocab words logged" value={totalVocab} accent="violet" />
        <StatCard icon={Scale} label="Grammar warnings" value={totalGrammar} accent="red" />
        <StatCard icon={Sparkles} label="Sessions logged" value={logs.length} accent="red" />
      </div>

      <div className="grid-2col">
        {/* Practice Tasks Column */}
        <div>
          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title">Daily Practice Tasks</span>
            </div>
            
            <div className="task-button-grid">
              {TASK_TYPES.map((t) => (
                <button key={t.key} className="task-btn" onClick={() => handleStartTask(t)}>
                  <Mic size={18} color="var(--signal-amber)" />
                  <span className="task-btn-title">{t.label}</span>
                  <span className="task-btn-desc">{t.desc}</span>
                </button>
              ))}
            </div>

            {activeTask && (
              <form onSubmit={handleSaveLog} className="form-grid" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-hairline)' }}>
                <div>
                  <label className="label-eyebrow">Task Prompt</label>
                  <div className="prompt-display">
                    {loadingTask ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)' }}>
                        <Sparkles size={14} className="spin" /> Generating practice prompt...
                      </span>
                    ) : (
                      taskPrompt
                    )}
                  </div>
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="label-eyebrow" style={{ marginBottom: 0 }}>Your Summary / Answer</label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--signal-teal)', cursor: 'pointer', fontWeight: 500 }}>
                      <Upload size={12} />
                      Import Text File
                      <input type="file" accept=".txt,.md,.json" onChange={handleImportTextFile} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <textarea
                    className="input"
                    rows={4}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Provide a written summary of what you spoke out loud. Your vocabulary and grammar statistics will be computed based on this input."
                    required
                    style={{ lineHeight: 1.5 }}
                  />
                </div>
                
                <div className="form-row-2">
                  <div>
                    <label className="label-eyebrow">Speaking minutes</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={minutes}
                      onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="label-eyebrow">Self-rated confidence (1-10)</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="10"
                      value={confidence}
                      onChange={(e) => setConfidence(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                
                <div className="modal-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => { setActiveTask(null); setTaskPrompt(''); setResponse(''); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || loadingTask}>{saving ? 'Saving…' : 'Log session'}</button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* History Feed Column */}
        <div>
          <div className="panel section-card">
            <div className="section-card-header">
              <span className="section-card-title">Practice History</span>
              <span className="label-eyebrow">{logs.length} logged</span>
            </div>

            {logs.length === 0 ? (
              <EmptyState icon={Mic} title="No logs found" copy="Complete your first speaking or writing task above to see the history feed." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id
                  const isEditing = editingLogId === log.id
                  const taskMeta = TASK_TYPES.find((t) => t.key === log.task_type) || { label: 'Speaking Task' }
                  
                  return (
                    <div key={log.id} className={`history-card ${isExpanded ? 'is-expanded' : ''}`}>
                      {/* Header */}
                      <div className="history-card-header" onClick={() => toggleExpandLog(log.id)}>
                        <div className="history-card-summary">
                          <span className="history-card-title">{log.task_prompt || taskMeta.label}</span>
                          <div className="history-card-meta">
                            <span>{new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                            <span>·</span>
                            <span>{log.speaking_minutes} min spent</span>
                          </div>
                        </div>
                        <div className="history-card-indicators">
                          <span className="tag tag-amber">{log.confidence_score}/10</span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {/* Expandable Details Container */}
                      {isExpanded && (
                        <>
                          {isEditing ? (
                            <form onSubmit={(e) => handleUpdateLog(e, log)} className="edit-form-wrapper form-grid">
                              <div>
                                <label className="label-eyebrow">Edit Response / Summary</label>
                                <textarea
                                  className="input"
                                  rows={4}
                                  value={editResponse}
                                  onChange={(e) => setEditResponse(e.target.value)}
                                  placeholder="Update your response..."
                                  required
                                  style={{ lineHeight: 1.5 }}
                                />
                              </div>
                              <div className="form-row-2">
                                <div>
                                  <label className="label-eyebrow">Minutes spent</label>
                                  <input
                                    className="input"
                                    type="number"
                                    min="0"
                                    value={editMinutes}
                                    onChange={(e) => setEditMinutes(parseInt(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="label-eyebrow">Confidence (1-10)</label>
                                  <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={editConfidence}
                                    onChange={(e) => setEditConfidence(parseInt(e.target.value) || 1)}
                                  />
                                </div>
                              </div>
                              <div className="modal-actions" style={{ marginTop: 8 }}>
                                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={updating}>
                                  {updating ? 'Saving...' : 'Save changes'}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="history-card-body">
                              {log.task_prompt && (
                                <div className="history-card-section">
                                  <span className="label-eyebrow">Task Prompt</span>
                                  <p style={{ fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic' }}>{log.task_prompt}</p>
                                </div>
                              )}
                              
                              <div className="history-card-section">
                                <span className="label-eyebrow">Your Response</span>
                                <p className="history-response-text">{log.task_response || 'No summary recorded.'}</p>
                              </div>

                              <div className="history-card-section">
                                <span className="label-eyebrow">Vocabulary keywords ({ensureArray(log.vocab_words).length})</span>
                                <div className="tags-container">
                                  {ensureArray(log.vocab_words).length > 0 ? (
                                    ensureArray(log.vocab_words).map((w, i) => (
                                      <span key={i} className="tag tag-neutral">{w}</span>
                                    ))
                                  ) : (
                                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No keywords parsed.</span>
                                  )}
                                </div>
                              </div>

                              <div className="history-card-section">
                                <span className="label-eyebrow">Grammar suggestions</span>
                                <div className="tags-container">
                                  {ensureArray(log.grammar_mistakes).filter(m => m !== '—').length > 0 ? (
                                    ensureArray(log.grammar_mistakes).filter(m => m !== '—').map((m, i) => (
                                      <span key={i} className="tag tag-red">{m}</span>
                                    ))
                                  ) : (
                                    <span className="tag tag-teal">No critical issues flagged</span>
                                  )}
                                </div>
                              </div>

                              {/* Card Action Drawer */}
                              <div className="history-actions">
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => startEdit(log)}>
                                  <Edit size={12} /> Edit
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--signal-red)' }} onClick={() => handleDeleteLog(log.id)}>
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
        </div>
      </div>
    </div>
  )
}
