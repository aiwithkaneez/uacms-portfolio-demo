import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import api from '../api/client.js'
import { formatCategory, formatStatus, formatDate } from '../utils/complaintFormat.js'

function AssignedComplaintsList() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/v1/complaints/desk')
      .then(({ data }) => {
        if (!cancelled) setComplaints(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your desk queue. Please refresh the page.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Assigned Complaints</h1>
        <p>Every complaint routed to your desk, with its current status.</p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 16px 4px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Queue</h3>
        </div>

        {loading && <div className="empty-state">Loading…</div>}
        {!loading && error && <div className="empty-state">{error}</div>}
        {!loading && !error && complaints.length === 0 && (
          <div className="empty-state">No complaints have been routed to your desk yet.</div>
        )}
        {!loading &&
          !error &&
          complaints.map((c) => (
            <Link
              to={`/deskowner/complaint/${c.id}`}
              key={c.id}
              className="list-row"
              style={{ padding: '14px 16px', color: 'inherit' }}
            >
              <div className="list-row-main">
                <span className="list-row-title">
                  {c.case_id} <span className="category-pill">{formatCategory(c.category)}</span>
                </span>
                <span className="list-row-sub">
                  {c.submitted_by} · Submitted {formatDate(c.created_at)}
                </span>
              </div>
              <div className="list-row-right" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {c.is_escalated && <span className="badge badge-escalated">Escalated</span>}
                <StatusBadge status={formatStatus(c.status)} />
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

export default AssignedComplaintsList
