import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import ComplaintIdSuccess from '../components/ComplaintIdSuccess.jsx'

// Manual category selection is intentional. The
// category-check call below is a soft, dismissible warning on top of this,
// never an automatic classifier: it never blocks or changes what gets
// submitted on its own, only what the employee explicitly confirms.
const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'grievance', label: 'Grievance' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'whistleblow', label: 'Whistleblow' },
]

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

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

function SubmitComplaint() {
  const location = useLocation()
  const [complaintText, setComplaintText] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].value)
  const [file, setFile] = useState(null)
  // Pre-set from the Dashboard's Anonymous/Disclosed buttons (location.state);
  // falls back to Disclosed if the page is reached directly.
  const [isAnonymous, setIsAnonymous] = useState(location.state?.anonymous ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fileError, setFileError] = useState('')
  const [caseId, setCaseId] = useState(null)
  // { suggested_category, confidence } when the description's wording looks
  // like a different category, or null. Dismissible — see doSubmit.
  const [mismatchWarning, setMismatchWarning] = useState(null)
  const navigate = useNavigate()

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

  async function doSubmit(trimmedText, submitCategory) {
    setSubmitting(true)

    const formData = new FormData()
    formData.append('description', trimmedText)
    formData.append('category', submitCategory)
    formData.append('is_anonymous', isAnonymous ? 'true' : 'false')
    if (file) formData.append('evidence', file)

    try {
      // api's default Content-Type is application/json — override it so the
      // browser sets multipart/form-data with the correct boundary instead.
      const { data } = await api.post('/api/v1/complaints', formData, {
        headers: { 'Content-Type': undefined },
      })
      if (!data.case_id) {
        setError('Complaint was registered, but no Complaint ID came back. Open Track Complaint to find it.')
        return
      }
      setCaseId(data.case_id)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Could not submit complaint. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return

    setError('')

    const trimmedText = complaintText.trim()
    if (trimmedText.length < MIN_COMPLAINT_LENGTH) {
      setError(`Please enter at least ${MIN_COMPLAINT_LENGTH} characters.`)
      return
    }
    if (trimmedText.length > MAX_COMPLAINT_LENGTH) {
      setError(`Complaint is too long. Please keep it under ${MAX_COMPLAINT_LENGTH} characters.`)
      return
    }
    if (fileError) {
      setError('Please resolve the evidence file issue before submitting.')
      return
    }

    // Already warned and the employee is proceeding — the warning UI's own
    // "Submit Anyway" button calls doSubmit directly, so reaching here with
    // a warning still set means the form was resubmitted some other way;
    // don't re-check, just respect their choice.
    if (mismatchWarning) {
      await doSubmit(trimmedText, category)
      return
    }

    setSubmitting(true)
    try {
      const { data } = await api.post('/api/v1/complaints/category-check', {
        description: trimmedText,
        category,
      })
      if (data.suggested_category) {
        setMismatchWarning(data)
        setSubmitting(false)
        return
      }
    } catch {
      // The check itself failing is never a reason to block a real
      // complaint from being submitted — fail open and proceed normally.
    }

    await doSubmit(trimmedText, category)
  }

  function switchToSuggestedCategory() {
    const trimmedText = complaintText.trim()
    const suggested = mismatchWarning.suggested_category
    setCategory(suggested)
    setMismatchWarning(null)
    doSubmit(trimmedText, suggested)
  }

  function submitAnyway() {
    const trimmedText = complaintText.trim()
    setMismatchWarning(null)
    doSubmit(trimmedText, category)
  }

  if (caseId) {
    return (
      <div className="page">
        <div className="card">
          <ComplaintIdSuccess caseId={caseId}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/employee/track')}>
                Track My Complaints
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/employee/dashboard')}>
                Back to Dashboard
              </button>
            </div>
          </ComplaintIdSuccess>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isAnonymous ? 'Submit an Anonymous Complaint' : 'Submit a Complaint'}</h1>
        <p>
          {isAnonymous
            ? 'Your identity will not be shared. Describe your concern below and pick the category that fits best.'
            : 'Describe your concern and pick the category that fits best.'}
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="complaintText">
            {isAnonymous ? 'What would you like to report anonymously?' : 'What would you like to report?'}
          </label>
          <textarea
            id="complaintText"
            placeholder="Describe your complaint in as much detail as possible..."
            value={complaintText}
            onChange={(e) => setComplaintText(e.target.value)}
            rows={7}
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
              ? 'Your identity will not be shared with the desk owner.'
              : 'Your name and employee ID will be attached to this complaint.'}
          </div>
        </div>

        {mismatchWarning && (
          <div className="banner-warning field">
            <strong>This sounds like it might be a {CATEGORY_LABEL[mismatchWarning.suggested_category]} complaint.</strong>
            <p style={{ margin: '4px 0 10px' }}>
              You selected {CATEGORY_LABEL[category]}, but the wording closely matches our{' '}
              {CATEGORY_LABEL[mismatchWarning.suggested_category]} policy. This is just a suggestion — your complaint
              will be registered either way.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={switchToSuggestedCategory}>
                Switch to {CATEGORY_LABEL[mismatchWarning.suggested_category]}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={submitAnyway}>
                Submit as {CATEGORY_LABEL[category]} anyway
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="field hint" style={{ color: '#b42318', marginBottom: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            submitting ||
            complaintText.trim().length < MIN_COMPLAINT_LENGTH ||
            complaintText.trim().length > MAX_COMPLAINT_LENGTH ||
            !!fileError
          }
        >
          {submitting ? 'Submitting…' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  )
}

export default SubmitComplaint
