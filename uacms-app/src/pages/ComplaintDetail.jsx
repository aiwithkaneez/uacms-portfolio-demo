import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import UpdateStatusModal from '../components/UpdateStatusModal.jsx'
import TimelineLog from '../components/TimelineLog.jsx'
import SuggestionPanel from '../components/SuggestionPanel.jsx'
import api from '../api/client.js'
import { formatCategory, formatStatus } from '../utils/complaintFormat.js'

function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

  const [currentTime, setCurrentTime] = useState(Date.now())

  // Guards against a stale response overwriting newer state if `id` changes
  // again before the in-flight request resolves.
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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  async function handleUpdate({ status, note }) {
    await api.patch(`/api/v1/complaints/${id}/status`, { status, note })
    await loadComplaint()
  }

  if (loading) return <div className="page">Loading…</div>

  if (error) {
    return (
      <div className="page">
        <div className="card empty-state">
          {error}
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate('/deskowner/queue')}
            >
              ← Back to Queue
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!complaint) return null

  const isOpen = complaint.status === 'new' || complaint.status === 'in_progress'
  const dueDate = complaint.due_at ? new Date(complaint.due_at) : null

  const remainingMs = dueDate
    ? dueDate.getTime() - currentTime
    : 0

  // Only an open complaint can be "overdue" — once resolved/closed, TAT is no
  // longer ticking, so the urgency banner shouldn't keep counting past it.
  const isOverdue = isOpen && remainingMs < 0

  const totalMinutes = Math.floor(Math.abs(remainingMs) / 60000)
  const remainingDays = Math.floor(totalMinutes / (60 * 24))
  const remainingHours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const remainingMinutes = totalMinutes % 60

  return (
    <div className="page">
      <button
        className="btn btn-outline btn-sm"
        style={{ marginBottom: 16 }}
        onClick={() => navigate(-1)}
      >
        ← Back to Queue
      </button>

      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}
      >
        <div>
          <h1>
            {complaint.case_id}{' '}
            <span className="category-pill">
              {formatCategory(complaint.category)}
            </span>
          </h1>

          <p>
            Submitted by {complaint.submitted_by} on{' '}
            {new Date(complaint.created_at).toLocaleDateString()}
            {complaint.assigned_desk && (
              <>
                {' '}
                · Assigned desk: {complaint.assigned_desk}
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {complaint.is_escalated && <span className="badge badge-escalated">Escalated</span>}
          <StatusBadge status={formatStatus(complaint.status)} />
        </div>
      </div>

      {complaint.is_escalated && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: '#fee2e2',
            color: '#b91c1c',
            fontWeight: 600,
          }}
        >
          ⚠ Auto-escalated{complaint.escalated_at && ` on ${new Date(complaint.escalated_at).toLocaleString()}`} — this
          complaint was still "New" after its TAT lapsed, and is now visible to Executives.
        </div>
      )}

      <div className="grid-2">

        <div className="card">

          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>
            Complaint Details
          </h3>

          <p
            style={{
              fontSize: '0.9rem',
              lineHeight: 1.6
            }}
          >
            {complaint.description}
          </p>

          <hr style={{ margin: '18px 0' }} />

          <div style={{ marginBottom: 10 }}>
            <strong>Assigned Desk:</strong><br />
            {complaint.assigned_desk}
          </div>

          {(complaint.contact_phone || complaint.contact_email || complaint.submitter_employee_id) && (
            <div style={{ marginBottom: 10 }}>
              <strong>Complainant Contact:</strong><br />
              {complaint.contact_phone && <>{complaint.contact_phone}<br /></>}
              {complaint.contact_email && <>{complaint.contact_email}<br /></>}
              {complaint.submitter_employee_id && <>Employee ID: {complaint.submitter_employee_id}</>}
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <strong>Turnaround Time:</strong><br />
            {complaint.tat_hours} Hours
          </div>

          <div style={{ marginBottom: 10 }}>
            <strong>Due By:</strong><br />
            {dueDate?.toLocaleString()}
          </div>

          {dueDate && (
            <div
              style={{
                marginBottom: 18,
                padding: '10px',
                borderRadius: '8px',
                background: isOverdue
                  ? '#ffe8e8'
                  : '#eef7ee',
                color: isOverdue
                  ? '#c62828'
                  : '#2e7d32',
                fontWeight: 600
              }}
            >
              {!isOpen ? (
                <>✓ {formatStatus(complaint.status)} — no longer tracked against TAT</>
              ) : isOverdue ? (
                <>
                  ⚠ Overdue by{' '}
                  {remainingDays > 0 && `${remainingDays}d `}
                  {remainingHours}h {remainingMinutes}m
                </>
              ) : (
                <>
                  🕒 Due in{' '}
                  {remainingDays > 0 && `${remainingDays}d `}
                  {remainingHours}h {remainingMinutes}m
                </>
              )}
            </div>
          )}

          {complaint.attachments?.length > 0 && (
            <div
              className="list-row-sub"
              style={{ marginBottom: 12 }}
            >
              <strong>Evidence:</strong>{' '}
              {complaint.attachments
                .map((a) => a.file_name)
                .join(', ')}
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => setShowModal(true)}
          >
            Update Status / Add Note
          </button>

        </div>

        <div className="card">
          <h3
            style={{
              marginTop: 0,
              fontSize: '1rem'
            }}
          >
            Complaint Timeline
          </h3>

          <TimelineLog events={complaint.timeline} />
        </div>

      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>🤖 Policy-Based AI Recommendation Engine</h3>
        <p className="list-row-sub" style={{ marginTop: -8, marginBottom: 14 }}>
          Retrieved from the fictional sample procedures for this category — advisory only, review before acting.
        </p>
        <SuggestionPanel complaintId={id} onDecisionRecorded={loadComplaint} />
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

export default ComplaintDetail
