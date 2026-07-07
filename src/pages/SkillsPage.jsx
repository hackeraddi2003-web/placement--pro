import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Layers, BookMarked } from 'lucide-react'
import {
  ensureLanguagesSeeded, ensureSubjectsSeeded,
  updateLanguageProgress, updateSubjectProgress,
  createLanguageProgress, deleteLanguageProgress,
  createSubjectProgress, deleteSubjectProgress,
} from '../lib/api/skills'

const LEVELS = ['Beginner', 'Intermediate', 'Advanced']

export default function SkillsPage() {
  const { user } = useAuth()
  const activeUserId = user?.id || 'anon'
  const [languages, setLanguages] = useState([])
  const [subjects, setSubjects] = useState([])
  const [tab, setTab] = useState('languages')

  const load = useCallback(async () => {
    if (!user) return
    const [langs, subs] = await Promise.all([
      ensureLanguagesSeeded(activeUserId),
      ensureSubjectsSeeded(activeUserId),
    ])
    setLanguages(langs.sort((a, b) => a.language.localeCompare(b.language)))
    setSubjects(subs.sort((a, b) => a.subject.localeCompare(b.subject)))
  }, [user, activeUserId])

  useEffect(() => { load() }, [load])

  const handleLangUpdate = async (lang, updates) => {
    const updated = await updateLanguageProgress(activeUserId, lang.id, updates)
    setLanguages((prev) => prev.map((l) => (l.id === lang.id ? updated : l)))
  }

  const handleSubjectUpdate = async (subj, updates) => {
    const updated = await updateSubjectProgress(activeUserId, subj.id, updates)
    setSubjects((prev) => prev.map((s) => (s.id === subj.id ? updated : s)))
  }

  const [newLanguage, setNewLanguage] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [addingLanguage, setAddingLanguage] = useState(false)
  const [addingSubject, setAddingSubject] = useState(false)

  const handleAddLanguage = async () => {
    if (!newLanguage.trim()) return
    if (!user) {
      alert('Please sign in to add a language.')
      return
    }
    try {
      setAddingLanguage(true)
      console.log('Adding language', newLanguage)
      const created = await createLanguageProgress(activeUserId, newLanguage.trim())
      console.log('Added language result', created)
      setLanguages((prev) => [created, ...prev])
      setNewLanguage('')
    } catch (err) {
      console.error('Add language failed', err)
      alert('Failed to add language. Check console for details.')
    } finally {
      setAddingLanguage(false)
    }
  }

  // wrapper so we log clicks immediately before async work
  const handleAddLanguageClick = (e) => {
    console.log('Add language clicked', { newLanguage, user })
    handleAddLanguage()
  }

  const handleAddSubject = async () => {
    if (!newSubject.trim()) return
    if (!user) {
      alert('Please sign in to add a subject.')
      return
    }
    try {
      setAddingSubject(true)
      console.log('Adding subject', newSubject)
      const created = await createSubjectProgress(activeUserId, newSubject.trim())
      console.log('Added subject result', created)
      setSubjects((prev) => [created, ...prev])
      setNewSubject('')
    } catch (err) {
      console.error('Add subject failed', err)
      alert('Failed to add subject. Check console for details.')
    } finally {
      setAddingSubject(false)
    }
  }

  const handleAddSubjectClick = (e) => {
    console.log('Add subject clicked', { newSubject, user })
    handleAddSubject()
  }

  const handleDeleteLanguage = async (lang) => {
    if (!confirm(`Delete language "${lang.language}"? This can't be undone.`)) return
    await deleteLanguageProgress(activeUserId, lang.id)
    setLanguages((prev) => prev.filter((l) => l.id !== lang.id))
  }

  const handleDeleteSubject = async (subj) => {
    if (!confirm(`Delete subject "${subj.subject}"? This can't be undone.`)) return
    await deleteSubjectProgress(activeUserId, subj.id)
    setSubjects((prev) => prev.filter((s) => s.id !== subj.id))
  }

  const handleEditLanguage = async (lang) => {
    const name = prompt('Edit language name', lang.language)
    if (!name || name.trim() === lang.language) return
    const updated = await updateLanguageProgress(activeUserId, lang.id, { language: name.trim() })
    setLanguages((prev) => prev.map((l) => (l.id === lang.id ? updated : l)))
  }

  const handleEditSubject = async (subj) => {
    const name = prompt('Edit subject name', subj.subject)
    if (!name || name.trim() === subj.subject) return
    const updated = await updateSubjectProgress(activeUserId, subj.id, { subject: name.trim() })
    setSubjects((prev) => prev.map((s) => (s.id === subj.id ? updated : s)))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Languages & Core Subjects</h1>
          <p className="page-subtitle">Track depth across programming languages and CS fundamentals.</p>
        </div>
        <div className="view-toggle">
          <button className={`view-toggle-btn ${tab === 'languages' ? 'is-active' : ''}`} onClick={() => setTab('languages')}>
            <Layers size={15} /> Languages
          </button>
          <button className={`view-toggle-btn ${tab === 'subjects' ? 'is-active' : ''}`} onClick={() => setTab('subjects')}>
            <BookMarked size={15} /> Core Subjects
          </button>
        </div>
      </div>

      {tab === 'languages' ? (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="input" placeholder="Add language (e.g. Rust)" value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} />
            <button type="button" className="btn" onMouseDown={() => console.log('Add language mousedown')} onClick={handleAddLanguageClick} disabled={!user || addingLanguage} title={!user ? 'Sign in to add' : ''}>{addingLanguage ? 'Adding…' : 'Add'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {languages.map((lang) => (
              <div key={lang.id} className="panel section-card">
                <div className="section-card-header">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="section-card-title">{lang.language}</span>
                    <button className="btn btn-ghost" onClick={() => handleEditLanguage(lang)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => handleDeleteLanguage(lang)}>Delete</button>
                  </div>
                  <select
                    className="input" style={{ width: 130, padding: '6px 10px', fontSize: 12 }}
                    value={lang.current_level}
                    onChange={(e) => handleLangUpdate(lang, { current_level: e.target.value })}
                  >
                    {LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <label className="label-eyebrow">Topics completed (comma separated)</label>
                <textarea
                  className="input" rows={2} style={{ marginTop: 6, marginBottom: 12 }}
                  defaultValue={lang.topics_completed?.join(', ') || ''}
                  onBlur={(e) => handleLangUpdate(lang, { topics_completed: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                />
                <label className="label-eyebrow">Practice log</label>
                <textarea
                  className="input" rows={2} style={{ marginTop: 6 }}
                  defaultValue={lang.practice_log || ''}
                  onBlur={(e) => handleLangUpdate(lang, { practice_log: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="input" placeholder="Add subject (e.g. Algorithms)" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            <button type="button" className="btn" onMouseDown={() => console.log('Add subject mousedown')} onClick={handleAddSubjectClick} disabled={!user || addingSubject} title={!user ? 'Sign in to add' : ''}>{addingSubject ? 'Adding…' : 'Add'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {subjects.map((subj) => (
              <div key={subj.id} className="panel section-card">
                <div className="section-card-header">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="section-card-title">{subj.subject}</span>
                    <button className="btn btn-ghost" onClick={() => handleEditSubject(subj)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => handleDeleteSubject(subj)}>Delete</button>
                  </div>
                  <span className="tag tag-amber">{subj.progress_pct || 0}%</span>
                </div>
                <label className="label-eyebrow">Progress: {subj.progress_pct || 0}%</label>
                <input
                  type="range" min="0" max="100" style={{ width: '100%', marginTop: 6, marginBottom: 14 }}
                  value={subj.progress_pct || 0}
                  onChange={(e) => handleSubjectUpdate(subj, { progress_pct: parseInt(e.target.value) })}
                />
                <label className="label-eyebrow">Notes</label>
                <textarea
                  className="input" rows={3} style={{ marginTop: 6 }}
                  defaultValue={subj.notes || ''}
                  onBlur={(e) => handleSubjectUpdate(subj, { notes: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
