import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { FolderKanban, Plus, Github, ExternalLink, Trash2, Upload } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { getProjects, addProject, updateProject, deleteProject } from '../lib/api/projects'
import { compressImage } from '../lib/imageCompressor'

const STATUS_COLORS = { planning: 'neutral', in_progress: 'amber', completed: 'teal' }

const BLANK = {
  title: '', description: '', tech_stack: '', github_link: '', live_link: '',
  status: 'planning', features: '', learning_outcomes: '', challenges: '',
  screenshot_urls: [],
}

export default function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setProjects(await getProjects(user.id))
  }, [user])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowModal(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      ...p,
      tech_stack: p.tech_stack?.join(', ') || '',
      screenshot_urls: p.screenshot_urls || []
    })
    setShowModal(true)
  }

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    const compressedList = []
    for (const file of files) {
      try {
        const compressed = await compressImage(file, 800, 0.7)
        compressedList.push(compressed)
      } catch (err) {
        console.error('Image compression failed:', err)
      }
    }

    setForm((prev) => ({
      ...prev,
      screenshot_urls: [...(prev.screenshot_urls || []), ...compressedList]
    }))
    setUploading(false)
    e.target.value = '' // clear input
  }

  const removeScreenshot = (idx, e) => {
    e.stopPropagation()
    setForm((prev) => ({
      ...prev,
      screenshot_urls: prev.screenshot_urls.filter((_, i) => i !== idx)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      tech_stack: form.tech_stack.split(',').map((s) => s.trim()).filter(Boolean),
      screenshot_urls: form.screenshot_urls || []
    }
    if (editing) {
      const updated = await updateProject(editing.id, payload)
      setProjects((prev) => prev.map((p) => (p.id === editing.id ? updated : p)))
    } else {
      const created = await addProject(user.id, payload)
      setProjects((prev) => [created, ...prev])
    }
    setShowModal(false)
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this project?')) return
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('Delete project failed', err)
      alert('Failed to delete project. See console for details.')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> New project</button>
      </div>

      {projects.length === 0 ? (
        <div className="panel section-card">
          <EmptyState icon={FolderKanban} title="No projects yet" copy="Add EVA AI, JARVIS AI, or your campus LMS to start tracking outcomes." />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {projects.map((p) => (
            <div key={p.id} className="panel section-card project-card" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', position: 'relative' }} onClick={() => openEdit(p)}>
              {p.screenshot_urls && p.screenshot_urls.length > 0 && (
                <div style={{ height: 160, width: '100%', overflow: 'hidden', borderRadius: 'var(--r-lg) var(--r-lg) 0 0', margin: '-20px -20px 14px -20px', borderBottom: '1px solid var(--border-hairline)' }}>
                  <img src={p.screenshot_urls[0]} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div className="section-card-header" style={{ marginBottom: 8 }}>
                <span className="section-card-title">{p.title}</span>
                <span className={`tag tag-${STATUS_COLORS[p.status]}`}>{p.status.replace('_', ' ')}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, minHeight: 36, flexGrow: 1 }}>{p.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {p.tech_stack?.map((t) => <span key={t} className="tag tag-neutral">{t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-hairline)' }}>
                {p.github_link && (
                  <a href={p.github_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-secondary)' }} title="GitHub">
                    <Github size={16} />
                  </a>
                )}
                {p.live_link && (
                  <a href={p.live_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-secondary)' }} title="Live demo">
                    <ExternalLink size={16} />
                  </a>
                )}
                <button
                  className="icon-btn" style={{ marginLeft: 'auto', color: 'var(--signal-red)' }}
                  onClick={(e) => handleDelete(p.id, e)}
                  title="Delete project"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit project' : 'New project'} onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <input className="input" placeholder="Project title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="input" placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="input" placeholder="Tech stack (comma separated)" value={form.tech_stack} onChange={(e) => setForm({ ...form, tech_stack: e.target.value })} />
            <div className="form-row-2">
              <input className="input" placeholder="GitHub link" value={form.github_link} onChange={(e) => setForm({ ...form, github_link: e.target.value })} />
              <input className="input" placeholder="Live link" value={form.live_link} onChange={(e) => setForm({ ...form, live_link: e.target.value })} />
            </div>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="planning">Planning</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>

            {/* Screenshot Upload list */}
            <div>
              <label className="label-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Screenshots / Gallery</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {(form.screenshot_urls || []).map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 72, height: 54, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-active)' }}>
                    <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={(e) => removeScreenshot(idx, e)}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 72, height: 54, border: '1px dashed var(--border-active)', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-base)' }}>
                  <Upload size={16} color="var(--text-secondary)" />
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>{uploading ? '...' : 'Add'}</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} style={{ display: 'none' }} disabled={uploading} />
                </label>
              </div>
            </div>

            <textarea className="input" placeholder="Key features" rows={2} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
            <textarea className="input" placeholder="Learning outcomes" rows={2} value={form.learning_outcomes} onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })} />
            <textarea className="input" placeholder="Challenges faced" rows={2} value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {editing ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
