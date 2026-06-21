import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Layers, BookMarked } from 'lucide-react'
import {
  ensureLanguagesSeeded, ensureSubjectsSeeded,
  updateLanguageProgress, updateSubjectProgress,
} from '../lib/api/skills'

const LEVELS = ['Beginner', 'Intermediate', 'Advanced']

export default function SkillsPage() {
  const { user } = useAuth()
  const [languages, setLanguages] = useState([])
  const [subjects, setSubjects] = useState([])
  const [tab, setTab] = useState('languages')

  const load = useCallback(async () => {
    if (!user) return
    const [langs, subs] = await Promise.all([
      ensureLanguagesSeeded(user.id),
      ensureSubjectsSeeded(user.id),
    ])
    setLanguages(langs.sort((a, b) => a.language.localeCompare(b.language)))
    setSubjects(subs.sort((a, b) => a.subject.localeCompare(b.subject)))
  }, [user])

  useEffect(() => { load() }, [load])

  const handleLangUpdate = async (lang, updates) => {
    const updated = await updateLanguageProgress(lang.id, updates)
    setLanguages((prev) => prev.map((l) => (l.id === lang.id ? updated : l)))
  }

  const handleSubjectUpdate = async (subj, updates) => {
    const updated = await updateSubjectProgress(subj.id, updates)
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {languages.map((lang) => (
            <div key={lang.id} className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">{lang.language}</span>
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
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {subjects.map((subj) => (
            <div key={subj.id} className="panel section-card">
              <div className="section-card-header">
                <span className="section-card-title">{subj.subject}</span>
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
      )}
    </div>
  )
}
