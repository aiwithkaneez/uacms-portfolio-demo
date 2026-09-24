import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { exportAdminOverview, getAdminComplaintOverview } from '../api/dashboard.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatCategory, formatStatus, formatDate } from '../utils/complaintFormat.js'

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'grievance', label: 'Grievance' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'whistleblow', label: 'Whistleblow' },
]

function AdminComplaintOversight() {
  const [category, setCategory] = useState('')
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await exportAdminOverview(category || undefined)
    } catch {
      setError('Could not export complaints. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAdminComplaintOverview(category || undefined)
      .then((data) => {
        if (!cancelled) {
          setComplaints(data)
          setError('')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load complaint overview. Please refresh the page.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [category])

  const escalatedCount = complaints.filter((c) => c.is_escalated).length

  return (
    <div className="page">
      <div className="page-header">
        <h1>Complaint Oversight</h1>
        <p>Every complaint, its assigned desk, response time, and escalation state.</p>
      </div>

      {!loading && escalatedCount > 0 && (
        <div
          className="card"
          style={{ marginBottom: 16, background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}
        >
          ⚠ {escalatedCount} complaint{escalatedCount === 1 ? '' : 's'} auto-escalated — still "New" after TAT
          lapsed.
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <label htmlFor="categoryFilter">Category</label>
          <select id="categoryFilter" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-outline" onClick={handleExport} disabled={exporting || loading}>
          {exporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 16px 4px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>All Complaints ({complaints.length})</h3>
        </div>

        {loading && <div className="empty-state">Loading…</div>}
        {!loading && error && <div className="empty-state">{error}</div>}
        {!loading && !error && complaints.length === 0 && (
          <div className="empty-state">No complaints match this filter.</div>
        )}
        {!loading &&
          !error &&
          complaints.map((c) => (
            <Link
              to={`/admin/complaint/${c.id}`}
              key={c.id}
              className="list-row"
              style={{ padding: '14px 16px', display: 'block', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div className="list-row-main">
                  <span className="list-row-title">
                    {c.case_id} <span className="category-pill">{formatCategory(c.category)}</span>
                  </span>
                  <span className="list-row-sub">
                    {c.assigned_desk ?? 'Unassigned'} · Submitted {formatDate(c.created_at)}
                    {c.response_time_hours != null
                      ? ` · Responded in ${c.response_time_hours}h`
                      : ' · No response yet'}
                  </span>
                </div>
                <div className="list-row-right" style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {c.is_escalated && <span className="badge badge-escalated">Escalated</span>}
                  <StatusBadge status={formatStatus(c.status)} />
                </div>
              </div>
              <p className="list-row-sub" style={{ marginTop: 8, marginBottom: 0 }}>
                {c.description}
              </p>
            </Link>
          ))}
      </div>
    </div>
  )
}

export default AdminComplaintOversight
