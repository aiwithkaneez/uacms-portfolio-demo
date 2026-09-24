import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import api from '../api/client.js'
import { formatCategory, formatStatus, formatDate } from '../utils/complaintFormat.js'

const PREVIEW_COUNT = 4

function DeskOwnerDashboard() {
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

  const counts = {
    new: complaints.filter((c) => c.status === 'new').length,
    in_progress: complaints.filter((c) => c.status === 'in_progress').length,
    resolved: complaints.filter((c) => c.status === 'resolved').length,
    closed: complaints.filter((c) => c.status === 'closed').length,
  }

  const preview = complaints.slice(0, PREVIEW_COUNT)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Desk Owner Dashboard</h1>
        <p>Complaints routed to your desk by rule-based category assignment.</p>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-value">{counts.new}</div>
          <div className="stat-label">New</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{counts.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{counts.resolved}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{counts.closed}</div>
          <div className="stat-label">Closed</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Recent Queue</h3>
          <Link to="/deskowner/queue" className="list-row-sub">
            View All →
          </Link>
        </div>

        {loading && <p className="list-row-sub">Loading…</p>}
        {!loading && error && <div className="banner-error">{error}</div>}
        {!loading && !error && preview.length === 0 && (
          <p className="list-row-sub">No complaints have been routed to your desk yet.</p>
        )}

        {!loading &&
          !error &&
          preview.map((c) => (
            <Link to={`/deskowner/complaint/${c.id}`} key={c.id} className="list-row" style={{ color: 'inherit' }}>
              <div className="list-row-main">
                <span className="list-row-title">
                  {c.case_id} <span className="category-pill">{formatCategory(c.category)}</span>
                </span>
                <span className="list-row-sub">
                  {c.submitted_by} · Submitted {formatDate(c.created_at)}
                </span>
              </div>
              <div className="list-row-right">
                <StatusBadge status={formatStatus(c.status)} />
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

export default DeskOwnerDashboard
