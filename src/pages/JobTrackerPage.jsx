import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Briefcase, Plus, Trash2, IndianRupee, Calendar } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import {
  JOB_STAGES, JOB_STAGE_LABELS,
  getJobApplications, addJobApplication, updateJobApplication, deleteJobApplication,
} from '../lib/api/jobs'

const BLANK = {
  company: '', role: '', package_lpa: '', application_date: new Date().toISOString().slice(0, 10),
  stage: 'applied', oa_status: '', interview_status: '', result: '', notes: '',
}

const STAGE_ACCENT = {
  applied: 'neutral',
  oa: 'amber',
  interview: 'violet',
  offer: 'teal',
  rejected: 'red',
}

export default function JobTrackerPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [dragId, setDragId] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    setJobs(await getJobApplications(user.id))
  }, [user])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowModal(true) }
  const openEdit = (job) => {
    setEditing(job)
    setForm({ ...job, package_lpa: job.package_lpa ?? '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...form, package_lpa: form.package_lpa === '' ? null : Number(form.package_lpa) }
    if (editing) {
      const updated = await updateJobApplication(editing.id, payload)
      setJobs((prev) => prev.map((j) => (j.id === editing.id ? updated : j)))
    } else {
      const created = await addJobApplication(user.id, payload)
      setJobs((prev) => [created, ...prev])
    }
    setShowModal(false)
  }

  const handleDelete = async (id) => {
    await deleteJobApplication(id)
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }

  const moveStage = async (id, stage) => {
    const updated = await updateJobApplication(id, { stage })
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)))
  }

  const handleDrop = (stage) => {
    if (dragId) moveStage(dragId, stage)
    setDragId(null)
  }

  const counts = JOB_STAGES.reduce((acc, s) => {
    acc[s] = jobs.filter((j) => j.stage === s).length
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Applications</h1>
          <p className="page-subtitle">{jobs.length} application{jobs.length !== 1 ? 's' : ''} tracked across all stages</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Log application</button>
      </div>

      {jobs.length === 0 ? (
        <div className="panel section-card">
          <EmptyState icon={Briefcase} title="No applications yet" copy="Log your first application to start tracking it through OA, interview, and offer." />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {JOB_STAGES.map((stage) => (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
              className="panel"
              style={{ padding: 12, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`tag tag-${STAGE_ACCENT[stage]}`}>{JOB_STAGE_LABELS[stage]}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{counts[stage]}</span>
              </div>

              {jobs.filter((j) => j.stage === stage).map((j) => (
                <div
                  key={j.id}
                  draggable
                  onDragStart={() => setDragId(j.id)}
                  onClick={() => openEdit(j)}
                  className="panel"
                  style={{
                    padding: 10, borderRadius: 'var(--r-sm)', cursor: 'grab',
                    background: 'var(--bg-panel-raised)', border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{j.company}</span>
                    <button
                      className="icon-btn" style={{ width: 24, height: 24 }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(j.id) }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {j.role && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{j.role}</div>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {j.package_lpa != null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IndianRupee size={11} />{j.package_lpa} LPA
                      </span>
                    )}
                    {j.application_date && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Calendar size={11} />{j.application_date}
                      </span>
                    )}
                  </div>

                  {/* Quick stage move for mobile/no-drag */}
                  <select
                    className="input"
                    style={{ marginTop: 8, fontSize: 11, padding: '5px 8px' }}
                    value={j.stage}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => moveStage(j.id, e.target.value)}
                  >
                    {JOB_STAGES.map((s) => (
                      <option key={s} value={s}>{JOB_STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit application' : 'Log application'} onClose={() => setShowModal(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-row-2">
              <input className="input" placeholder="Company" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <input className="input" placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
            <div className="form-row-2">
              <input className="input" type="number" step="0.1" placeholder="Package (LPA)" value={form.package_lpa} onChange={(e) => setForm({ ...form, package_lpa: e.target.value })} />
              <input className="input" type="date" value={form.application_date} onChange={(e) => setForm({ ...form, application_date: e.target.value })} />
            </div>
            <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {JOB_STAGES.map((s) => <option key={s} value={s}>{JOB_STAGE_LABELS[s]}</option>)}
            </select>
            <input className="input" placeholder="OA status (e.g. cleared, pending)" value={form.oa_status} onChange={(e) => setForm({ ...form, oa_status: e.target.value })} />
            <input className="input" placeholder="Interview status / rounds" value={form.interview_status} onChange={(e) => setForm({ ...form, interview_status: e.target.value })} />
            <input className="input" placeholder="Result" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
            <textarea className="input" placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editing ? 'Save changes' : 'Add application'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
