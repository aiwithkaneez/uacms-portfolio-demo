import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api/client.js'
import { formatCategory, formatStatus, formatDate } from '../utils/complaintFormat.js'

function EmployeeDashboard() {
  const { user } = useAuth()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/v1/complaints')
      .then(({ data }) => {
        if (!cancelled) setComplaints(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your complaints.')
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
  const preview = complaints.slice(0, 5)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Welcome Back, {user?.fullName || 'there'}</h1>
        <p>Here you can view the status, progress, and latest updates for any concerns you've previously reported.</p>
      </div>

      <div className="card cta-card" style={{ marginBottom: 20 }}>
        <div className="cta-row">
          <div>
            <div style={{ fontWeight: 600 }}>Help us create a better workplace</div>
            <div className="list-row-sub">Report any issue you've experienced or witnessed. You can submit your complaint anonymously.</div>
          </div>
          <div className="cta-actions">
            <Link to="/employee/submit" state={{ anonymous: true }} className="btn btn-outline">
              Anonymous
            </Link>
            <Link to="/employee/submit" state={{ anonymous: false }} className="btn btn-primary">
              Disclosed
            </Link>
          </div>
        </div>
      </div>

      {!loading && !error && complaints.length > 0 && (
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
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>My Complaints</h3>
          <Link to="/employee/track" className="list-row-sub">
            View All →
          </Link>
        </div>
        {loading && <div className="list-row-sub">Loading…</div>}
        {!loading && error && <div className="list-row-sub">{error}</div>}
        {!loading && !error && complaints.length === 0 && (
          <div className="list-row-sub">You haven't submitted any complaints yet.</div>
        )}
        {!loading &&
          !error &&
          preview.map((c) => (
            <Link to={`/employee/track/${c.id}`} key={c.id} className="list-row" style={{ color: 'inherit' }}>
              <div className="list-row-main">
                <span className="list-row-title">
                  {c.case_id} <span className="category-pill">{formatCategory(c.category)}</span>
                </span>
                <span className="list-row-sub">Submitted {formatDate(c.created_at)}</span>
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

export default EmployeeDashboard
