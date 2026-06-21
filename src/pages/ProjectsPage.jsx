import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { FolderKanban, Plus, Github, ExternalLink, Trash2 } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { getProjects, addProject, updateProject, deleteProject } from '../lib/api/projects'

const STATUS_COLORS = { planning: 'neutral', in_progress: 'amber', completed: 'teal' }

const BLANK = {
  title: '', description: '', tech_stack: '', github_link: '', live_link: '',
  status: 'planning', features: '', learning_outcomes: '', challenges: '',
}

export default function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)

  const load = useCallback(async () => {
    if (!user) return
    setProjects(await getProjects(user.id))
  }, [user])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowModal(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({ ...p, tech_stack: p.tech_stack?.join(', ') || '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...form, tech_stack: form.tech_stack.split(',').map((s) => s.trim()).filter(Boolean) }
    if (editing) {
      const updated = await updateProject(editing.id, payload)
      setProjects((prev) => prev.map((p) => (p.id === editing.id ? updated : p)))
    } else {
      const created = await addProject(user.id, payload)
      setProjects((prev) => [created, ...prev])
    }
    setShowModal(false)
  }

  const handleDelete = async (id) => {
    await deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
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
            <div key={p.id} className="panel section-card" style={{ cursor: 'pointer' }} onClick={() => openEdit(p)}>
              <div className="section-card-header">
                <span className="section-card-title">{p.title}</span>
                <span className={`tag tag-${STATUS_COLORS[p.status]}`}>{p.status.replace('_', ' ')}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, minHeight: 36 }}>{p.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {p.tech_stack?.map((t) => <span key={t} className="tag tag-neutral">{t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {p.github_link && (
                  <a href={p.github_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-secondary)' }}>
                    <Github size={16} />
                  </a>
                )}
                {p.live_link && (
                  <a href={p.live_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-secondary)' }}>
                    <ExternalLink size={16} />
                  </a>
                )}
                <button
                  className="icon-btn" style={{ marginLeft: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
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
            <textarea className="input" placeholder="Key features" rows={2} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
            <textarea className="input" placeholder="Learning outcomes" rows={2} value={form.learning_outcomes} onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })} />
            <textarea className="input" placeholder="Challenges faced" rows={2} value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editing ? 'Save changes' : 'Create project'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
