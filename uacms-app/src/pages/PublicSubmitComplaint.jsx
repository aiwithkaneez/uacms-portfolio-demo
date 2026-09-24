import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import ComplaintIdSuccess from '../components/ComplaintIdSuccess.jsx'

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'grievance', label: 'Grievance' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'whistleblow', label: 'Whistleblow' },
]

const MIN_COMPLAINT_LENGTH = 10
const MAX_COMPLAINT_LENGTH = 5000
const MAX_FILE_SIZE_MB = 10
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const EMPLOYEE_ID_PATTERN = /^\d{5}$/

function PublicSubmitComplaint() {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].value)
  const [isEmployee, setIsEmployee] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [caseId, setCaseId] = useState(null)

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null
    setFileError('')

    if (!selected) {
      setFile(null)
      return
    }
    if (selected.size === 0) {
      setFileError('That file appears to be empty. Please choose a different file.')
      e.target.value = ''
      setFile(null)
      return
    }
    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`File is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`)
      e.target.value = ''
      setFile(null)
      return
    }
    if (selected.type && !ALLOWED_FILE_TYPES.includes(selected.type)) {
      setFileError('Unsupported file type. Please attach a PDF, Word document, or image.')
      e.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')

    const trimmedText = description.trim()
    if (trimmedText.length < MIN_COMPLAINT_LENGTH) {
      setError(`Please enter at least ${MIN_COMPLAINT_LENGTH} characters.`)
      return
    }
    if (trimmedText.length > MAX_COMPLAINT_LENGTH) {
      setError(`Complaint is too long. Please keep it under ${MAX_COMPLAINT_LENGTH} characters.`)
      return
    }
    if (isEmployee && !EMPLOYEE_ID_PATTERN.test(employeeId)) {
      setError('Employee ID must be exactly 5 digits.')
      return
    }
    if (!phone.trim() && !email.trim()) {
      setError('Please provide a phone number or email so you can check your complaint status later.')
      return
    }
    if (fileError) {
      setError('Please resolve the evidence file issue before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const { data } = await api.post('/api/v1/complaints/public', {
        description: trimmedText,
        category,
        is_employee: isEmployee,
        employee_id: isEmployee ? employeeId : null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        is_anonymous: isAnonymous,
      })

      if (file) {
        const formData = new FormData()
        formData.append('evidence', file)
        try {
          await api.post(`/api/v1/complaints/public/evidence/${data.case_id}`, formData, {
            headers: { 'Content-Type': undefined },
          })
        } catch {
          // The complaint itself is already registered successfully — a failed
          // evidence upload shouldn't look like the whole submission failed.
        }
      }

      if (!data.case_id) {
        setError('Complaint was registered, but no Complaint ID came back. Please try checking status with your phone or email, or submit again.')
        return
      }
      setCaseId(data.case_id)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 429) {
        setError('Too many submissions from this connection. Please try again later.')
      } else {
        setError(typeof detail === 'string' ? detail : 'Could not submit complaint. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (caseId) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ maxWidth: 480 }}>
          <ComplaintIdSuccess caseId={caseId}>
            <Link to="/public/status" className="btn btn-primary btn-block" style={{ marginTop: 20, marginBottom: 10 }}>
              Check Status Now
            </Link>
            <Link to="/" className="btn btn-outline btn-block">
              Back to Home
            </Link>
          </ComplaintIdSuccess>
        </div>
      </div>
    )
  }

  return (
    <div className="login-wrap" style={{ alignItems: 'flex-start', paddingTop: 40, paddingBottom: 40 }}>
      <form className="login-card" style={{ maxWidth: 560 }} onSubmit={handleSubmit}>
        <h1>Report a Concern</h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>
          No account needed. You'll get a reference ID to check status later — no login required.
        </p>

        <div className="field">
          <label htmlFor="description">What would you like to report?</label>
          <textarea
            id="description"
            placeholder="Describe your complaint in as much detail as possible..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            maxLength={MAX_COMPLAINT_LENGTH}
          />
          <div className="hint">At least {MIN_COMPLAINT_LENGTH} characters.</div>
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="evidence">Attach Evidence (optional)</label>
          <input id="evidence" type="file" onChange={handleFileChange} />
          {fileError && (
            <div className="hint" style={{ color: '#b42318' }}>
              {fileError}
            </div>
          )}
          {!fileError && file && <div className="hint">Selected: {file.name}</div>}
        </div>

        <div className="field">
          <label>Are you an employee of this organization?</label>
          <div className="toggle-group">
            <button
              type="button"
              className={`toggle-option${!isEmployee ? ' active' : ''}`}
              onClick={() => {
                setIsEmployee(false)
                setEmployeeId('')
              }}
            >
              No
            </button>
            <button
              type="button"
              className={`toggle-option${isEmployee ? ' active' : ''}`}
              onClick={() => setIsEmployee(true)}
            >
              Yes
            </button>
          </div>
        </div>

        {isEmployee && (
          <div className="field">
            <label htmlFor="employeeId">Employee ID (5 digits)</label>
            <input
              id="employeeId"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 04821"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, '').slice(0, 5))}
              maxLength={5}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            type="tel"
            placeholder="Enter your phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="hint">You'll use your phone or email to check status later — either works.</div>
        </div>

        <div className="field">
          <label>Submission Type</label>
          <div className="toggle-group">
            <button
              type="button"
              className={`toggle-option${!isAnonymous ? ' active' : ''}`}
              onClick={() => setIsAnonymous(false)}
            >
              Disclosed
            </button>
            <button
              type="button"
              className={`toggle-option${isAnonymous ? ' active' : ''}`}
              onClick={() => setIsAnonymous(true)}
            >
              Anonymous
            </button>
          </div>
          <div className="hint">
            {isAnonymous
              ? "Your phone, email, and employee ID won't be shown to the desk owner — you'll still be able to check status yourself."
              : 'The desk owner will be able to see your phone, email, and employee ID to follow up with you.'}
          </div>
        </div>

        {error && (
          <p className="field hint" style={{ color: '#b42318', marginBottom: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting || description.trim().length < MIN_COMPLAINT_LENGTH || !!fileError}
        >
          {submitting ? 'Submitting…' : 'Submit Complaint'}
        </button>

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

export default PublicSubmitComplaint
