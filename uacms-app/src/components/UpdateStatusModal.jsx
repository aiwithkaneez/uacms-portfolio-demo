import { useState } from 'react'
import { formatStatus } from '../utils/complaintFormat.js'

// Only forward transitions are allowed, matching the backend's VALID_TRANSITIONS map,
// except resolved -> in_progress (reopening), which the backend also allows.
const NEXT_STATUSES = {
  new: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed', 'in_progress'],
  closed: [],
}

function UpdateStatusModal({ currentStatus, onClose, onUpdate }) {
  const options = NEXT_STATUSES[currentStatus] || []
  const [status, setStatus] = useState(options[0] || currentStatus)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleUpdate() {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onUpdate({ status, note: note.trim() || null })
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update the complaint. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Update Status</h2>

        {error && <div className="banner-error">{error}</div>}

        {options.length === 0 ? (
          <p className="list-row-sub">This complaint is closed and cannot be updated further.</p>
        ) : (
          <div className="field">
            <label htmlFor="status">New status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {formatStatus(s)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="note">Investigation note (optional)</label>
          <textarea
            id="note"
            rows={4}
            placeholder="Add findings, next steps, or context for this update..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpdate}
            disabled={submitting || (options.length === 0 && !note.trim())}
          >
            {submitting ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpdateStatusModal