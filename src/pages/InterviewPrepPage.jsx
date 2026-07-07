import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getLocalYYYYMMDD } from '../lib/supabaseClient'
import { Brain, Plus, Trash2, Edit, ChevronDown, ChevronUp, Sparkles, Clock, Star, X, Check, BookOpen } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import {
  INTERVIEW_CATEGORIES, DEFAULT_HR_QUESTIONS,
  getInterviewQuestions, addInterviewQuestion, updateInterviewQuestion, deleteInterviewQuestion,
} from '../lib/api/interview'
import {
  getLanguageProgress, createLanguageProgress, updateLanguageProgress, deleteLanguageProgress
} from '../lib/api/skills'
import { generateAIResponse } from '../lib/aiProvider'
import { loadAiSettings } from '../lib/api/profile'
import './InterviewPrepPage.css'

const LOCAL_SAMPLE_QUESTIONS = {
  OOPs: [
    'Explain dynamic binding and polymorphism with an inheritance code example.',
    'What is the difference between an abstract class and an interface? When should you use which?',
    'Explain the 4 main pillars of OOPs with real-world analogies.',
    'How does Java simulate multiple inheritance and how are conflicts resolved?',
    'What is the difference between aggregation, association, and composition?'
  ],
  DBMS: [
    'Explain Database Normalization (1NF, 2NF, 3NF, BCNF) and its practical trade-offs.',
    'What are ACID properties in transaction management? Explain each with an example.',
    'Explain the difference between clustered and non-clustered indexes in SQL databases.',
    'What is a deadlock in database systems, and what are the techniques to resolve it?',
    'Explain transaction isolation levels and concurrency anomalies (dirty read, non-repeatable read).'
  ],
  SQL: [
    'Write an SQL query to find the N-th highest salary of an employee without using LIMIT.',
    'Explain the visual difference between INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN.',
    'What are window functions? Write a query using DENSE_RANK() to find rank by department.',
    'Explain the difference between GROUP BY and HAVING clauses with a sample query.',
    'Write a query to delete duplicate rows from a table while preserving the lowest ID.'
  ],
  OS: [
    'Explain virtual memory, paging, and how page faults are resolved by the OS kernel.',
    'What is the difference between a process and a thread? Explain context switching overhead.',
    'Explain CPU scheduling algorithms (Round Robin, SJF, Priority) and their trade-offs.',
    'What is thrashing in operating systems, and how can it be mitigated?',
    'Explain the producer-consumer problem and how to solve it using semaphores.'
  ],
  CN: [
    'Explain TCP three-way handshake, connection termination, and congestion control.',
    'Describe step-by-step what happens when you type a URL like www.google.com in a browser.',
    'Explain the OSI model layers and the primary protocols operating at each layer.',
    'What is DNS (Domain Name System) and how does iterative query resolution work?',
    'What is the difference between IPv4 and IPv6, and how does NAT work?'
  ],
  HR: [
    'Tell me about yourself, highlighting your MCA project achievements.',
    'Why should we hire you over other candidates? What value do you bring?',
    'Describe a conflict you had in a team project and how you resolved it (STAR method).',
    'What are your greatest professional strengths and weaknesses?',
    'Where do you see yourself in 5 years? Describe your career path goals.'
  ],
  Java: [
    'Explain memory management in Java: Heap vs. Stack memory allocation.',
    'What is garbage collection in Java? Explain minor, major, and full GC.',
    'What is the difference between HashMap, HashTable, and ConcurrentHashMap?',
    'Explain class loaders and JVM architecture details.',
    'What are Java Streams? Write a snippet using filter, map, and reduce.'
  ],
  Python: [
    'How does Python manage memory internally? Explain the reference counting and cyclic garbage collector.',
    'What are decorators in Python? Write a custom execution timer decorator.',
    'Explain the difference between list, tuple, set, and dictionary in Python, focusing on time complexity.',
    'What is the Global Interpreter Lock (GIL) and how does it impact multi-threading?',
    'What is the difference between deep copy and shallow copy in Python?'
  ],
  JavaScript: [
    'Explain closures, lexical scoping, and the event loop execution model.',
    'What is the difference between var, let, and const in terms of hoisting and temporal dead zone?',
    'Explain Promises, async/await, and event propagation (bubbling vs. capturing).',
    'What is the prototype chain and how does inheritance work in JS prototypes?',
    'What is a debounce and throttle function? Explain with a sample implementation.'
  ],
  HTML: [
    'What are semantic HTML5 tags and why are they important for accessibility and SEO?',
    'Describe custom data attributes (data-* attributes) and how to interact with them in JS.',
    'What is the difference between localStorage, sessionStorage, and cookies?'
  ],
  CSS: [
    'Explain the CSS Box Model (content, padding, border, margin) and box-sizing properties.',
    'Explain Flexbox vs. CSS Grid and their ideal layout use cases.',
    'What is the difference between absolute, relative, fixed, static, and sticky positioning?'
  ]
}

export default function InterviewPrepPage() {
  const { user } = useAuth()
  const activeUserId = user?.id || 'anon'
  
  const [questions, setQuestions] = useState([])
  const [customLanguages, setCustomLanguages] = useState([])
  const [category, setCategory] = useState('')
  const [aiSettings, setAiSettings] = useState({ provider: 'none', apiKey: '' })
  const [successToast, setSuccessToast] = useState('')
  
  // Custom Category Input
  const [newCategoryInput, setNewCategoryInput] = useState('')

  // Custom Question Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ question: '', answer: '', confidence: 3 })
  const [isSaving, setIsSaving] = useState(false)

  // Expandable Accordion states
  const [expandedId, setExpandedId] = useState(null)

  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editConfidence, setEditConfidence] = useState(3)
  const [isUpdating, setIsUpdating] = useState(false)

  // AI Suggestion Box states
  const [suggestedQuestion, setSuggestedQuestion] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAddingSuggested, setIsAddingSuggested] = useState(false)

  const load = useCallback(async () => {
    const [data, settings, langs] = await Promise.all([
      getInterviewQuestions(activeUserId),
      loadAiSettings(activeUserId),
      getLanguageProgress(activeUserId)
    ])
    setQuestions(data)
    setAiSettings(settings)
    setCustomLanguages(langs)
  }, [activeUserId])

  useEffect(() => { load() }, [load])

  // Computed custom sidebar categories (no static base subjects)
  const sidebarCategories = useMemo(() => {
    return customLanguages.map((l) => ({ id: l.id, name: l.language, isCustom: true }))
  }, [customLanguages])

  // Select the first available category by default when categories load
  useEffect(() => {
    if (sidebarCategories.length > 0 && !category) {
      setCategory(sidebarCategories[0].name)
    }
  }, [sidebarCategories, category])

  // Categorize questions
  const categoryQuestions = useMemo(() => {
    return questions.filter((q) => q.category === category)
  }, [questions, category])

  // Category statistics calculated for sidebar
  const categoryStats = useMemo(() => {
    const stats = {}
    sidebarCategories.forEach((cat) => {
      const catQs = questions.filter((q) => q.category === cat.name)
      const count = catQs.length
      const avg = count
        ? Math.round(catQs.reduce((sum, q) => sum + (q.confidence || 1), 0) / count)
        : 0
      stats[cat.name] = { count, avg }
    })
    return stats
  }, [questions, sidebarCategories])

  // Add Custom Category / Language
  const handleAddCategory = async () => {
    if (!newCategoryInput.trim()) return
    const name = newCategoryInput.trim()
    const exists = sidebarCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      alert('Category already exists.')
      return
    }
    try {
      const created = await createLanguageProgress(activeUserId, name)
      setCustomLanguages((prev) => [...prev, created])
      setNewCategoryInput('')
      setCategory(name)
    } catch (err) {
      console.error('Failed to create language category', err)
    }
  }

  // Edit Custom Category / Language Name
  const handleEditCategoryName = async (catItem) => {
    const newName = prompt('Edit category/language name', catItem.name)
    if (!newName || newName.trim() === catItem.name) return
    const name = newName.trim()
    try {
      const updated = await updateLanguageProgress(activeUserId, catItem.id, { language: name })
      setCustomLanguages((prev) => prev.map((l) => (l.id === catItem.id ? updated : l)))
      
      const oldName = catItem.name
      const questionsToUpdate = questions.filter((q) => q.category === oldName)
      if (questionsToUpdate.length > 0) {
        await Promise.all(
          questionsToUpdate.map((q) => updateInterviewQuestion(activeUserId, q.id, { category: name }))
        )
        setQuestions((prev) => prev.map((q) => (q.category === oldName ? { ...q, category: name } : q)))
      }
      setCategory(name)
    } catch (err) {
      console.error('Failed to rename category:', err)
    }
  }

  // Delete Custom Category / Language
  const handleDeleteCategory = async (catItem) => {
    if (!window.confirm(`Delete category "${catItem.name}"? This will also delete all interview questions inside it.`)) return
    try {
      await deleteLanguageProgress(activeUserId, catItem.id)
      const remaining = customLanguages.filter((l) => l.id !== catItem.id)
      setCustomLanguages(remaining)
      
      const questionsToDelete = questions.filter((q) => q.category === catItem.name)
      if (questionsToDelete.length > 0) {
        await Promise.all(
          questionsToDelete.map((q) => deleteInterviewQuestion(activeUserId, q.id))
        )
        setQuestions((prev) => prev.filter((q) => q.category !== catItem.name))
      }
      
      if (remaining.length > 0) {
        setCategory(remaining[0].language)
      } else {
        setCategory('')
      }
    } catch (err) {
      console.error('Failed to delete category:', err)
    }
  }

  // Add Custom Question Handler
  const handleAddQuestionSubmit = async (e) => {
    e.preventDefault()
    if (!category) {
      alert('Please create or select a category first.')
      return
    }
    if (!addForm.question.trim()) return
    setIsSaving(true)
    try {
      const created = await addInterviewQuestion(activeUserId, { ...addForm, category })
      setQuestions((prev) => [created, ...prev])
      setExpandedId(created.id)
      setSuccessToast(`Saved to ${category}!`)
      setTimeout(() => setSuccessToast(''), 3000)
      setAddForm({ question: '', answer: '', confidence: 3 })
      setShowAddModal(false)
    } catch (err) {
      console.error('Failed to add custom question', err)
      alert('Could not save the question.')
    } finally {
      setIsSaving(false)
    }
  }

  // Suggest Practice Question (using Gemini / local fallback list)
  const handleSuggestPracticeQuestion = async () => {
    if (!category) {
      alert('Please add a category/language first.')
      return
    }
    setIsGenerating(true)
    setSuggestedQuestion('')
    try {
      if (aiSettings.provider === 'none' || !aiSettings.apiKey) {
        const list = LOCAL_SAMPLE_QUESTIONS[category] || LOCAL_SAMPLE_QUESTIONS.OOPs
        const randomQ = list[Math.floor(Math.random() * list.length)]
        const exists = questions.some((q) => q.question.toLowerCase() === randomQ.toLowerCase())
        if (exists) {
          setSuggestedQuestion(`${randomQ} (Explain in detail)`)
        } else {
          setSuggestedQuestion(randomQ)
        }
      } else {
        const prompt = `Generate one standard, high-level technical or behavioral interview question for placement preparation under the category "${category}". Respond with ONLY the question text itself. Do not wrap in quotes or add headers.`
        const result = await generateAIResponse(prompt, { provider: aiSettings.provider, apiKey: aiSettings.apiKey })
        setSuggestedQuestion(result.text.replace(/^["']|["']$/g, ''))
      }
    } catch (err) {
      console.error('Failed to suggest practice question', err)
      setSuggestedQuestion('Explain the main differences between dynamic and static routing.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAddSuggestedQuestion = async () => {
    if (!suggestedQuestion) return
    setIsAddingSuggested(true)
    try {
      const created = await addInterviewQuestion(activeUserId, {
        category,
        question: suggestedQuestion,
        answer: '',
        confidence: 1
      })
      setQuestions((prev) => [created, ...prev])
      setExpandedId(created.id)
      setSuccessToast(`Suggested question saved to ${category}!`)
      setTimeout(() => setSuccessToast(''), 3000)
      setSuggestedQuestion('')
    } catch (err) {
      console.error('Failed to add suggested question', err)
    } finally {
      setIsAddingSuggested(false)
    }
  }

  // Inline Edit logic
  const handleStartEditing = (q) => {
    setEditingId(q.id)
    setEditQuestion(q.question || '')
    setEditAnswer(q.answer || '')
    setEditConfidence(q.confidence || 3)
  }

  const handleCancelEditing = () => {
    setEditingId(null)
    setEditQuestion('')
    setEditAnswer('')
    setEditConfidence(3)
  }

  const handleSaveUpdate = async (e, q) => {
    e.preventDefault()
    if (!editQuestion.trim()) return
    setIsUpdating(true)
    try {
      const payload = {
        question: editQuestion.trim(),
        answer: editAnswer.trim(),
        confidence: parseInt(editConfidence) || 1,
        last_practiced: editAnswer.trim() ? getLocalYYYYMMDD() : q.last_practiced
      }
      const updated = await updateInterviewQuestion(activeUserId, q.id, payload)
      setQuestions((prev) => prev.map((item) => (item.id === q.id ? updated : item)))
      handleCancelEditing()
    } catch (err) {
      console.error('Failed to save update', err)
      alert('Could not update the question.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interview question?')) return
    try {
      await deleteInterviewQuestion(activeUserId, id)
      setQuestions((prev) => prev.filter((q) => q.id !== id))
      if (expandedId === id) setExpandedId(null)
      if (editingId === id) handleCancelEditing()
    } catch (err) {
      console.error('Failed to delete question', err)
    }
  }

  const toggleExpandCard = (id) => {
    if (editingId && editingId !== id) {
      if (!window.confirm('Discard unsaved edit changes?')) return
      handleCancelEditing()
    }
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Interview Preparation</h1>
          <p className="page-subtitle">
            Curate questions, draft STAR answers, and build confidence levels.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add custom question
        </button>
      </div>

      <div className="interview-grid">
        {/* Sidebar Column */}
        <aside>
          {/* Add custom category / language */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input
              className="input"
              style={{ padding: '8px 10px', fontSize: 13 }}
              placeholder="Add language/cat..."
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory()
              }}
            />
            <button
              className="btn"
              style={{ padding: '8px 12px', fontSize: 13 }}
              onClick={handleAddCategory}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="category-nav-list">
            {sidebarCategories.map((cat) => {
              const stats = categoryStats[cat.name] || { count: 0, avg: 0 }
              const isActive = category === cat.name
              return (
                <button
                  key={cat.id || cat.name}
                  className={`cat-nav-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    if (editingId) {
                      if (!window.confirm('Discard unsaved edit changes?')) return
                      handleCancelEditing()
                    }
                    setCategory(cat.name)
                    setSuggestedQuestion('')
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span className="cat-nav-card-label">{cat.name}</span>
                    <div className="cat-nav-card-stats">
                      <span>{stats.count} Qs</span>
                      {stats.count > 0 && (
                        <span className="tag tag-amber" style={{ padding: '1px 5px', fontSize: 10 }}>
                          ★ {stats.avg}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {cat.isCustom && (
                    <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: 4, height: 'auto', width: 'auto', color: 'var(--text-tertiary)' }}
                        onClick={() => handleEditCategoryName(cat)}
                        title="Rename Category"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: 4, height: 'auto', width: 'auto', color: 'var(--signal-red)' }}
                        onClick={() => handleDeleteCategory(cat)}
                        title="Delete Category"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* AI Practice Generator Card */}
          <div className="ai-suggestion-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={16} color="var(--signal-violet)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>AI Practice Partner</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Generate a realistic mock question for the <strong>{category}</strong> category.
            </p>
            
            {suggestedQuestion ? (
              <div>
                <div className="ai-suggestion-prompt">{suggestedQuestion}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '6px 12px', fontSize: 12, background: 'var(--signal-violet)', border: 'none', color: '#fff' }}
                    onClick={handleAddSuggestedQuestion}
                    disabled={isAddingSuggested}
                  >
                    {isAddingSuggested ? 'Saving...' : 'Add to practice list'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '6px' }}
                    onClick={() => setSuggestedQuestion('')}
                    title="Clear"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 12, padding: '8px 12px', fontSize: 12, borderColor: 'var(--border-hairline)' }}
                onClick={handleSuggestPracticeQuestion}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Suggest a question'}
              </button>
            )}
          </div>
        </aside>

        {/* Main Feed Column */}
        <main>
          {categoryQuestions.length === 0 ? (
            <div className="panel section-card">
              <EmptyState
                icon={Brain}
                title={`No questions for ${category}`}
                copy="Create custom questions or use the AI Practice Partner on the left to generate mock interview prompts."
              />
            </div>
          ) : (
            <div>
              {categoryQuestions.map((q) => {
                const isExpanded = expandedId === q.id
                const isEditing = editingId === q.id
                
                return (
                  <div key={q.id} className={`accordion-card ${isExpanded ? 'is-expanded' : ''}`}>
                    {/* Header */}
                    <div className="accordion-card-header" onClick={() => toggleExpandCard(q.id)}>
                      <span className="accordion-card-title">{q.question}</span>
                      
                      <div className="accordion-card-indicators">
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((lvl) => (
                            <Star
                              key={lvl}
                              size={12}
                              fill={q.confidence >= lvl ? 'var(--signal-amber)' : 'none'}
                              color={q.confidence >= lvl ? 'var(--signal-amber)' : 'var(--text-tertiary)'}
                            />
                          ))}
                        </div>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Collapsible Details Body */}
                    {isExpanded && (
                      <>
                        {isEditing ? (
                          <form onSubmit={(e) => handleSaveUpdate(e, q)} className="edit-form-wrapper form-grid">
                            <div>
                              <label className="label-eyebrow">Question text</label>
                              <textarea
                                className="input"
                                rows={2}
                                value={editQuestion}
                                onChange={(e) => setEditQuestion(e.target.value)}
                                required
                              />
                            </div>
                            
                            <div>
                              <label className="label-eyebrow">Answer (bullet points or full text)</label>
                              <textarea
                                className="input"
                                rows={4}
                                value={editAnswer}
                                onChange={(e) => setEditAnswer(e.target.value)}
                                placeholder="Draft a structured answer here..."
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <label className="label-eyebrow" style={{ marginBottom: 0 }}>Self confidence</label>
                              <div className="confidence-stars-container">
                                {[1, 2, 3, 4, 5].map((lvl) => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    className="star-rating-btn"
                                    onClick={() => setEditConfidence(lvl)}
                                  >
                                    <Star
                                      size={18}
                                      fill={editConfidence >= lvl ? 'var(--signal-amber)' : 'none'}
                                      color={editConfidence >= lvl ? 'var(--signal-amber)' : 'var(--text-tertiary)'}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="modal-actions" style={{ marginTop: 8 }}>
                              <button type="button" className="btn btn-ghost" onClick={handleCancelEditing}>Cancel</button>
                              <button type="submit" className="btn btn-primary" disabled={isUpdating}>
                                {isUpdating ? 'Saving...' : 'Save changes'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="accordion-card-body">
                            <div className="accordion-card-section">
                              <span className="label-eyebrow">Practice Answer</span>
                              <p className="accordion-answer-text">{q.answer || 'No answer recorded yet. Click Edit to draft one.'}</p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                              <div className="accordion-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                                <Clock size={12} />
                                <span>
                                  {q.last_practiced
                                    ? `Last practiced: ${new Date(q.last_practiced).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                    : 'Never practiced'}
                                </span>
                              </div>
                              
                              <div className="accordion-actions" style={{ border: 'none', padding: 0, margin: 0 }}>
                                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleStartEditing(q)}>
                                  <Edit size={12} /> Edit
                                </button>
                                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--signal-red)' }} onClick={() => handleDelete(q.id)}>
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
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
        </main>
      </div>

      {showAddModal && (
        <Modal title={`Add custom question to ${category}`} onClose={() => setShowAddModal(false)}>
          <form className="form-grid" onSubmit={handleAddQuestionSubmit}>
            <div>
              <label className="label-eyebrow">Question</label>
              <textarea
                className="input"
                placeholder="e.g. How does garbage collection work in Java?"
                required
                rows={2}
                value={addForm.question}
                onChange={(e) => setAddForm({ ...addForm, question: e.target.value })}
              />
            </div>
            
            <div>
              <label className="label-eyebrow">Answer (optional)</label>
              <textarea
                className="input"
                placeholder="Draft your response (STAR framework suggested)..."
                rows={4}
                value={addForm.answer}
                onChange={(e) => setAddForm({ ...addForm, answer: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label className="label-eyebrow" style={{ marginBottom: 0 }}>Confidence</label>
                <div className="confidence-stars-container">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className="star-rating-btn"
                      onClick={() => setAddForm((prev) => ({ ...prev, confidence: lvl }))}
                    >
                      <Star
                        size={16}
                        fill={addForm.confidence >= lvl ? 'var(--signal-amber)' : 'none'}
                        color={addForm.confidence >= lvl ? 'var(--signal-amber)' : 'var(--text-tertiary)'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Add'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
      {successToast && (
        <div className="tag tag-teal" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10000, padding: '12px 20px', fontSize: 13, border: '1px solid var(--border-active)', boxShadow: 'var(--shadow-raised)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={16} />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  )
}
