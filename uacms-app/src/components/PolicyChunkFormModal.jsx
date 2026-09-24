import { useState } from 'react'

const CATEGORY_OPTIONS = ['general', 'grievance', 'harassment', 'whistleblow']
const CLAUSE_TYPE_OPTIONS = ['conduct', 'process']

function PolicyChunkFormModal({ chunk, defaultCategory, onClose, onSave }) {
  const isEdit = !!chunk
  const [category, setCategory] = useState(chunk?.category ?? defaultCategory ?? CATEGORY_OPTIONS[0])
  const [clause, setClause] = useState(chunk?.clause ?? '')
  const [source, setSource] = useState(chunk?.source ?? '')
  const [text, setText] = useState(chunk?.text ?? '')
  const [clauseType, setClauseType] = useState(chunk?.clause_type ?? CLAUSE_TYPE_OPTIONS[0])
  const [isCoreProcedure, setIsCoreProcedure] = useState(chunk?.is_core_procedure ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (submitting) return
    if (!clause.trim() || !source.trim() || text.trim().length < 10) {
      setError('Clause name, source, and text (at least 10 characters) are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSave({
        category,
        clause: clause.trim(),
        source: source.trim(),
        text: text.trim(),
        clause_type: clauseType,
        is_core_procedure: isCoreProcedure,
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save this policy clause. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit Policy Clause' : 'Add Policy Clause'}</h2>
        {isEdit && (
          <p className="list-row-sub" style={{ marginTop: -8, marginBottom: 14 }}>
            Changing the text re-embeds this clause, so the AI engine retrieves it correctly going forward.
          </p>
        )}

        {error && <div className="banner-error">{error}</div>}

        <div className="field">
          <label htmlFor="pc-category">Category</label>
          <select id="pc-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="pc-clause">Clause Name</label>
          <input
            id="pc-clause"
            type="text"
            placeholder="e.g. Lodging Complaint of Harassment (10.1-10.2)"
            value={clause}
            onChange={(e) => setClause(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="pc-source">Source Document</label>
          <input
            id="pc-source"
            type="text"
            placeholder="e.g. Discrimination & Harassment at Work Policy"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="pc-text">Clause Text</label>
          <textarea
            id="pc-text"
            rows={6}
            placeholder="Paste the actual policy text this clause covers..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="pc-clause-type">Clause Type</label>
          <select id="pc-clause-type" value={clauseType} onChange={(e) => setClauseType(e.target.value)}>
            {CLAUSE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <div className="hint">"Process" clauses describe the handling procedure; "conduct" clauses describe what counts as a violation.</div>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={isCoreProcedure}
              onChange={(e) => setIsCoreProcedure(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Core Procedure — always shown to the desk owner for this category, regardless of match score
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Clause'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PolicyChunkFormModal
