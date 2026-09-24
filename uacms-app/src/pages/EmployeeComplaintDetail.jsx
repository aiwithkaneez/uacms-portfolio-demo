import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import ComplaintTimeline from '../components/ComplaintTimeline.jsx'
import TimelineLog from '../components/TimelineLog.jsx'
import api from '../api/client.js'
import { formatCategory, formatStatus, formatDate } from '../utils/complaintFormat.js'

function EmployeeComplaintDetail() {
  const { id } = useParams()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(`/api/v1/complaints/${id}`)
      .then(({ data }) => {
        if (!cancelled) setComplaint(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.status === 404 ? 'Complaint not found.' : 'Could not load this complaint.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="page">
        <div className="card empty-state">Loading…</div>
      </div>
    )
  }

  if (error || !complaint) {
    return (
      <div className="page">
        <div className="card empty-state">
          {error || `Complaint ${id} not found.`}
          <div style={{ marginTop: 12 }}>
            <Link to="/employee/track" className="btn btn-outline btn-sm">
              ← Back to My Complaints
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <Link to="/employee/track" className="btn btn-outline btn-sm" style={{ marginBottom: 16, display: 'inline-flex' }}>
        ← Back to My Complaints
      </Link>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>
            {complaint.case_id} <span className="category-pill">{formatCategory(complaint.category)}</span>
          </h1>
          <p>
            Submitted {formatDate(complaint.created_at)}
            {complaint.is_anonymous && <span className="mock-tag">Anonymous</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusBadge status={formatStatus(complaint.status)} />
        </div>
      </div>

      <div className="card">
        <ComplaintTimeline status={formatStatus(complaint.status)} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Complaint Details</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{complaint.description}</p>
          <p className="list-row-sub" style={{ marginTop: 12 }}>
            {complaint.assigned_desk ? `Assigned to ${complaint.assigned_desk}` : 'Not yet assigned to a desk'}
          </p>
          {complaint.attachments?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: '0.9rem' }}>Evidence</h3>
              {complaint.attachments.map((a) => (
                <div key={a.id} className="hint">
                  {a.file_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Activity</h3>
          <TimelineLog events={complaint.timeline} />
        </div>
      </div>
    </div>
  )
}

export default EmployeeComplaintDetail