import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Brain, Plus, Trash2 } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import {
  INTERVIEW_CATEGORIES, DEFAULT_HR_QUESTIONS,
  getInterviewQuestions, addInterviewQuestion, updateInterviewQuestion, deleteInterviewQuestion,
} from '../lib/api/interview'

export default function InterviewPrepPage() {
  const { user } = useAuth()
  const [questions, setQuestions] = useState([])
  const [category, setCategory] = useState('OOPs')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ question: '', answer: '', confidence: 3 })

  const load = useCallback(async () => {
    if (!user) return
    const data = await getInterviewQuestions(user.id)
    setQuestions(data)
  }, [user])

  useEffect(() => { load() }, [load])

  const seedHrIfEmpty = useCallback(async () => {
    if (!user) return
    const hrQs = questions.filter((q) => q.category === 'HR')
    if (hrQs.length > 0) return
    const created = await Promise.all(
      DEFAULT_HR_QUESTIONS.map((q) => addInterviewQuestion(user.id, { category: 'HR', question: q, confidence: 1 }))
    )
    setQuestions((prev) => [...prev, ...created])
  }, [user, questions])

  useEffect(() => {
    if (category === 'HR') seedHrIfEmpty()
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryQuestions = questions.filter((q) => q.category === category)

  const handleAdd = async (e) => {
    e.preventDefault()
    const created = await addInterviewQuestion(user.id, { ...form, category })
    setQuestions((prev) => [...prev, created])
    setForm({ question: '', answer: '', confidence: 3 })
    setShowModal(false)
  }

  const handleUpdate = async (q, updates) => {
    const updated = await updateInterviewQuestion(q.id, updates)
    setQuestions((prev) => prev.map((item) => (item.id === q.id ? updated : item)))
  }

  const handleDelete = async (id) => {
    await deleteInterviewQuestion(id)
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Interview Preparation</h1>
          <p className="page-subtitle">{questions.length} questions logged across all categories</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add question</button>
      </div>

      <div className="view-toggle" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        {INTERVIEW_CATEGORIES.map((c) => (
          <button key={c} className={`view-toggle-btn ${category === c ? 'is-active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {categoryQuestions.length === 0 ? (
        <div className="panel section-card">
          <EmptyState icon={Brain} title={`No ${category} questions yet`} copy="Add your first question to start building this category." />
        </div>
      ) : (
        <div className="panel section-card">
          {categoryQuestions.map((q) => (
            <div key={q.id} className="list-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 10, padding: '16px 0' }}>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{q.question}</div>
                <button className="icon-btn" onClick={() => handleDelete(q.id)}><Trash2 size={14} /></button>
              </div>
              <textarea
                className="input" rows={2} placeholder="Your answer…"
                defaultValue={q.answer || ''}
                onBlur={(e) => handleUpdate(q, { answer: e.target.value, last_practiced: new Date().toISOString().slice(0, 10) })}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="label-eyebrow">Confidence</span>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleUpdate(q, { confidence: lvl })}
                    style={{
                      width: 22, height: 22, borderRadius: 6, border: 'none',
                      background: q.confidence >= lvl ? 'var(--signal-amber)' : 'var(--bg-panel-raised)',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={`Add ${category} question`} onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleAdd}>
            <textarea className="input" placeholder="Question" required rows={2} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
            <textarea className="input" placeholder="Your answer (optional, can fill later)" rows={3} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
