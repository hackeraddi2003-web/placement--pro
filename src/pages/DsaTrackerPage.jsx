import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Code2, Plus, ExternalLink } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { ensureDsaTopicsSeeded, updateDsaTopic, getDsaProblems, addDsaProblem, deleteDsaProblem, updateDsaProblem } from '../lib/api/dsa'
import { awardXP } from '../lib/api/profile'

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started', color: 'neutral' },
  { value: 'in_progress', label: 'In progress', color: 'amber' },
  { value: 'completed', label: 'Completed', color: 'teal' },
  { value: 'revision_needed', label: 'Needs revision', color: 'red' },
]

export default function DsaTrackerPage() {
  const { user } = useAuth()
  const [topics, setTopics] = useState([])
  const [problems, setProblems] = useState([])
  const [activeTopic, setActiveTopic] = useState(null)
  const [showProblemModal, setShowProblemModal] = useState(false)
  const [newProblem, setNewProblem] = useState({ problem_name: '', difficulty: 'Medium', link: '', notes: '' })
  const [selectedProblem, setSelectedProblem] = useState(null)

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
    if (selectedProblem) {
      const updated = await updateDsaProblem(selectedProblem.id, { ...newProblem, topic_id: activeTopic.id })
      setProblems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setSelectedProblem(null)
    } else {
      const created = await addDsaProblem(user.id, { ...newProblem, topic_id: activeTopic.id })
      setProblems((prev) => [created, ...prev])
      await handleUpdateTopic(activeTopic, { problems_solved: (activeTopic.problems_solved || 0) + 1 })
      await awardXP(user.id, 15, 'DSA Problem Solved')
    }
    setNewProblem({ problem_name: '', difficulty: 'Medium', link: '', notes: '' })
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">DSA & LeetCode Tracker</h1>
          <p className="page-subtitle">{totalSolved} problems solved · {overallAvgProgress}% average topic progress</p>
        </div>
      </div>

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
                  <button className="btn btn-ghost" onClick={() => setShowProblemModal(true)}><Plus size={16} /> Add</button>
                </div>
                {topicProblems.length === 0 ? (
                  <EmptyState title="No problems logged" copy="Add the problems you've solved for this topic." />
                ) : (
                  topicProblems.map((p) => (
                    <div key={p.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => { setSelectedProblem(p); setNewProblem({ problem_name: p.problem_name, difficulty: p.difficulty || 'Medium', link: p.link || '', notes: p.notes || '' }); setShowProblemModal(true); }}>
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

      {showProblemModal && (
        <Modal title={`Add problem — ${activeTopic.topic_name}`} onClose={() => setShowProblemModal(false)}>
          <form className="form-grid" onSubmit={handleAddProblem}>
            <input className="input" autoFocus placeholder="Problem name" required value={newProblem.problem_name} onChange={(e) => setNewProblem({ ...newProblem, problem_name: e.target.value })} />
            <div className="form-row-2">
              <select className="input" value={newProblem.difficulty} onChange={(e) => setNewProblem({ ...newProblem, difficulty: e.target.value })}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
              <input className="input" placeholder="Link (optional)" value={newProblem.link} onChange={(e) => setNewProblem({ ...newProblem, link: e.target.value })} />
            </div>
            <textarea className="input" placeholder="Notes (optional)" rows={2} value={newProblem.notes} onChange={(e) => setNewProblem({ ...newProblem, notes: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowProblemModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add problem</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
