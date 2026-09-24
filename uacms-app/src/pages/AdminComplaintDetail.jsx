import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import UpdateStatusModal from '../components/UpdateStatusModal.jsx'
import TimelineLog from '../components/TimelineLog.jsx'
import api from '../api/client.js'
import { formatCategory, formatStatus } from '../utils/complaintFormat.js'

const DESK_OPTIONS = ['Operations', 'HR Employee Relations', 'HR Learning', 'FIU']

function AdminComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [reassignDesk, setReassignDesk] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [actionError, setActionError] = useState('')

  const latestRequestId = useRef(0)

  async function loadComplaint() {
    const requestId = ++latestRequestId.current
    try {
      const { data } = await api.get(`/api/v1/complaints/${id}`)
      if (requestId === latestRequestId.current) setComplaint(data)
    } catch (err) {
      if (requestId === latestRequestId.current) {
        setError(err.response?.data?.detail || 'Could not load this complaint.')
      }
    } finally {
      if (requestId === latestRequestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    loadComplaint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleUpdate({ status, note }) {
    await api.patch(`/api/v1/complaints/${id}/status`, { status, note })
    await loadComplaint()
  }

  async function handleEscalate() {
    if (escalating) return
    setEscalating(true)
    setActionError('')
    try {
      await api.post(`/api/v1/complaints/${id}/escalate`)
      await loadComplaint()
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Could not escalate this complaint.')
    } finally {
      setEscalating(false)
    }
  }

  async function handleReassign() {
    if (reassigning || !reassignDesk) return
    setReassigning(true)
    setActionError('')
    try {
      await api.patch(`/api/v1/complaints/${id}/reassign`, { desk: reassignDesk })
      setReassignDesk('')
      await loadComplaint()
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Could not reassign this complaint.')
    } finally {
      setReassigning(false)
    }
  }

  if (loading) return <div className="page">Loading…</div>

  if (error) {
    return (
      <div className="page">
        <div className="card empty-state">
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/complaints')}>
              ← Back to Complaint Oversight
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!complaint) return null

  return (
    <div className="page">
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate('/admin/complaints')}>
        ← Back to Complaint Oversight
      </button>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>
            {complaint.case_id} <span className="category-pill">{formatCategory(complaint.category)}</span>
          </h1>
          <p>
            Submitted by {complaint.submitted_by} on {new Date(complaint.created_at).toLocaleDateString()}
            {complaint.assigned_desk && <> · Assigned desk: {complaint.assigned_desk}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {complaint.is_escalated && <span className="badge badge-escalated">Escalated</span>}
          <StatusBadge status={formatStatus(complaint.status)} />
        </div>
      </div>

      {actionError && (
        <div className="card" style={{ marginBottom: 16, color: '#b91c1c' }}>
          {actionError}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Complaint Details</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{complaint.description}</p>

          <hr style={{ margin: '18px 0' }} />

          <div style={{ marginBottom: 10 }}>
            <strong>Assigned Desk:</strong>
            <br />
            {complaint.assigned_desk ?? 'Unassigned'}
          </div>
          <div style={{ marginBottom: 18 }}>
            <strong>Due By:</strong>
            <br />
            {new Date(complaint.due_at).toLocaleString()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setShowModal(true)}>
              Update Status / Add Note
            </button>

            <button
              className="btn btn-outline"
              onClick={handleEscalate}
              disabled={escalating || complaint.is_escalated}
            >
              {complaint.is_escalated ? 'Already Escalated' : escalating ? 'Escalating…' : 'Escalate Complaint'}
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={reassignDesk}
                onChange={(e) => setReassignDesk(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Forward to desk…</option>
                {DESK_OPTIONS.filter((d) => d !== complaint.assigned_desk).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button className="btn btn-outline" onClick={handleReassign} disabled={!reassignDesk || reassigning}>
                {reassigning ? 'Forwarding…' : 'Forward'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Activity Log</h3>
          <TimelineLog events={complaint.timeline} />
        </div>
      </div>

      {showModal && (
        <UpdateStatusModal
          currentStatus={complaint.status}
          onClose={() => setShowModal(false)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}

export default AdminComplaintDetail
