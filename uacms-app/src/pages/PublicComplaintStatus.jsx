import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { formatCategory, formatStatus } from '../utils/complaintFormat.js'

function formatEvent(event) {
  if (event.event_type === 'escalation') return 'Your complaint was escalated for management attention'
  if (!event.from_status) return `Complaint received — status "${formatStatus(event.to_status)}"`
  return `Status changed from "${formatStatus(event.from_status)}" to "${formatStatus(event.to_status)}"`
}

function PublicComplaintStatus() {
  const [caseId, setCaseId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setResult(null)

    if (!caseId.trim()) {
      setError('Please enter your reference ID.')
      return
    }
    if (!phone.trim() && !email.trim()) {
      setError('Please enter the phone number or email you submitted with.')
      return
    }

    setSubmitting(true)
    try {
      const { data } = await api.post('/api/v1/complaints/public/status', {
        case_id: caseId.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
      setResult(data)
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many attempts from this connection. Please try again later.')
      } else if (err.response?.status === 404) {
        setError('No matching complaint found. Check your reference ID and contact info and try again.')
      } else {
        setError('Could not look up your complaint. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap" style={{ alignItems: 'flex-start', paddingTop: 40, paddingBottom: 40 }}>
      <form className="login-card" style={{ maxWidth: 480 }} onSubmit={handleSubmit}>
        <h1>Check Complaint Status</h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>
          Enter your reference ID and the phone or email you submitted with.
        </p>

        <div className="field">
          <label htmlFor="caseId">Reference ID</label>
          <input
            id="caseId"
            type="text"
            placeholder="e.g. C-1042"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone Number</label>
          <input id="phone" type="tel" placeholder="Enter your phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {error && (
          <p className="field hint" style={{ color: '#b42318', marginBottom: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Looking up…' : 'Check Status'}
        </button>

        {result && (
          <div className="field" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>
              {result.case_id} <span className="category-pill">{formatCategory(result.category)}</span>
            </h3>
            <p className="list-row-sub">
              Status: <strong>{formatStatus(result.status)}</strong> · Due by {new Date(result.due_at).toLocaleString()}
            </p>
            <div className="timeline-log" style={{ marginTop: 12 }}>
              {result.timeline.map((event, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.85rem' }}>{formatEvent(event)}</div>
                  <div className="list-row-sub">{new Date(event.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to="/" className="hint" style={{ display: 'block', textAlign: 'center', marginTop: 14 }}>
          ← Back to Home
        </Link>
        <Link to="/staff/login" className="hint" style={{ display: 'block', textAlign: 'center', marginTop: 6 }}>
          Staff Login
        </Link>
      </form>
    </div>
  )
}

export default PublicComplaintStatus
