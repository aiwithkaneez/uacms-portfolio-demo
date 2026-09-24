import { useEffect, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { exportComplaints, getDashboardStats, getEscalatedComplaints, getSuggestionStats } from '../api/dashboard.js'
import { formatCategory, formatDate } from '../utils/complaintFormat.js'
import TimelineLog from '../components/TimelineLog.jsx'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const barOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
  },
}

const doughnutOptions = {
  responsive: true,
  plugins: {
    legend: { position: 'bottom' },
  },
}

const CATEGORY_COLORS = ['#b91c1c', '#b45309', '#1d4ed8', '#15803d', '#7c3aed', '#0f766e']
const STATUS_COLORS = ['#1d4ed8', '#b45309', '#15803d', '#b91c1c', '#6b7280']
const TAT_COLORS = ['#15803d', '#b91c1c']
const SUGGESTION_DECISION_COLORS = ['#15803d', '#b45309', '#b91c1c']

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'grievance', label: 'Grievance' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'whistleblow', label: 'Whistleblow' },
]

function ExecutiveDashboard() {
  const [category, setCategory] = useState('')
  const [stats, setStats] = useState(null)
  const [suggestionStats, setSuggestionStats] = useState(null)
  const [escalatedComplaints, setEscalatedComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await exportComplaints(category || undefined)
    } catch {
      setError('Could not export complaints. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const fetchStats = async () => {
      try {
        setLoading(true)
        const [data, suggestionData, escalatedData] = await Promise.all([
          getDashboardStats(category || undefined),
          getSuggestionStats(),
          getEscalatedComplaints(category || undefined),
        ])
        if (isMounted) {
          setStats(data)
          setSuggestionStats(suggestionData)
          setEscalatedComplaints(escalatedData)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load dashboard analytics. Please try again later.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchStats()

    return () => {
      isMounted = false
    }
  }, [category])

  const categoryChartData = stats?.by_category && {
    labels: stats.by_category.labels,
    datasets: [
      {
        label: 'Complaints',
        data: stats.by_category.data,
        backgroundColor: stats.by_category.labels.map(
          (_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]
        ),
        borderRadius: 6,
      },
    ],
  }

  const statusChartData = stats?.by_status && {
    labels: stats.by_status.labels,
    datasets: [
      {
        label: 'Complaints',
        data: stats.by_status.data,
        backgroundColor: stats.by_status.labels.map(
          (_, i) => STATUS_COLORS[i % STATUS_COLORS.length]
        ),
        borderRadius: 6,
      },
    ],
  }

  const tatChartData = stats?.tat_compliance && {
    labels: ['Within TAT', 'Overdue'],
    datasets: [
      {
        data: [stats.tat_compliance.within_tat_percent, stats.tat_compliance.overdue_percent],
        backgroundColor: TAT_COLORS,
        borderWidth: 0,
      },
    ],
  }

  const suggestionChartData = suggestionStats?.total_decisions > 0 && {
    labels: ['Accepted', 'Modified', 'Overridden'],
    datasets: [
      {
        data: [suggestionStats.accepted_percent, suggestionStats.modified_percent, suggestionStats.overridden_percent],
        backgroundColor: SUGGESTION_DECISION_COLORS,
        borderWidth: 0,
      },
    ],
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports &amp; Analytics</h1>
        <p>Monitor complaint performance, identify trends, and track resolution progress across the organization.</p>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, color: '#b91c1c' }}>
          {error}
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

      <div className="stat-row stat-row-5">
        <div className="stat-card">
          <div className="stat-value">{loading ? '—' : stats?.total_complaints ?? '—'}</div>
          <div className="stat-label">Total Complaints</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{loading ? '—' : stats?.open_count ?? '—'}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{loading ? '—' : stats?.resolved ?? '—'}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {loading ? '—' : stats?.avg_resolution_days != null ? `${stats.avg_resolution_days} days` : '—'}
          </div>
          <div className="stat-label">Avg Resolution Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: stats?.escalated_count ? '#b91c1c' : undefined }}>
            {loading ? '—' : stats?.escalated_count ?? '—'}
          </div>
          <div className="stat-label">Escalated</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 0 }}>
        <div style={{ padding: '16px 16px 4px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Escalated Complaints</h3>
          <p className="list-row-sub" style={{ marginTop: 4, marginBottom: 0 }}>
            Still "New" after their TAT lapsed — auto-escalated so they don't rely on a desk owner noticing.
          </p>
        </div>
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && !error && escalatedComplaints.length === 0 && (
          <div className="empty-state">No complaints are currently escalated.</div>
        )}
        {!loading &&
          !error &&
          escalatedComplaints.map((c) => (
            <div key={c.id} className="list-row" style={{ padding: '14px 16px', display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div className="list-row-main">
                  <span className="list-row-title">
                    {c.case_id} <span className="category-pill">{formatCategory(c.category)}</span>
                  </span>
                  <span className="list-row-sub">
                    Delayed at {c.assigned_desk ?? 'Unassigned'} · Submitted {formatDate(c.created_at)}
                    {c.escalated_at && ` · Escalated ${formatDate(c.escalated_at)}`}
                  </span>
                </div>
                <div className="list-row-right" style={{ flexShrink: 0 }}>
                  <span className="badge badge-escalated">Escalated</span>
                </div>
              </div>
              <p className="list-row-sub" style={{ marginTop: 10, marginBottom: 10 }}>
                {c.description}
              </p>
              <div>
                <strong style={{ fontSize: '0.8rem' }}>Desk activity</strong>
                <TimelineLog events={c.timeline} />
              </div>
            </div>
          ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Complaints by Category</h3>
          </div>
          {loading && <p>Loading…</p>}
          {!loading && categoryChartData && <Bar data={categoryChartData} options={barOptions} />}
          {!loading && !categoryChartData && !error && <p>No category data available.</p>}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Complaints by Status</h3>
          </div>
          {loading && <p>Loading…</p>}
          {!loading && statusChartData && <Bar data={statusChartData} options={barOptions} />}
          {!loading && !statusChartData && !error && <p>No status data available.</p>}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Within TAT vs Overdue</h3>
          </div>
          {loading && <p>Loading…</p>}
          {!loading && tatChartData && <Doughnut data={tatChartData} options={doughnutOptions} />}
          {!loading && !tatChartData && !error && <p>No TAT data available.</p>}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>AI Suggestion Acceptance Rate</h3>
          </div>
          <p className="list-row-sub" style={{ marginTop: -8, marginBottom: 12 }}>
            Evaluated by desk-owner Accept/Modify/Override decisions on Policy-Based AI Recommendation Engine suggestions — not a claimed accuracy score.
          </p>
          {loading && <p>Loading…</p>}
          {!loading && suggestionChartData && <Doughnut data={suggestionChartData} options={doughnutOptions} />}
          {!loading && !suggestionChartData && !error && (
            <p>No suggestion decisions recorded yet ({suggestionStats?.total_decisions ?? 0} so far).</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExecutiveDashboard