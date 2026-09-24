import { useEffect, useState } from 'react'
import api from '../api/client.js'

const CONFIDENCE_LABEL = {
  green: 'High Confidence',
  amber: 'Review Recommended',
  red: 'Low Confidence',
  none: 'No Match',
}

// Guaranteed clauses aren't weak matches, they're always-shown by design —
// see the is_guaranteed field on SuggestionItem. Showing "Standard
// Procedure" here instead of a confidence badge stops the badge implying
// the AI is unsure when it isn't measuring that at all for this clause.
function badgeInfo(s) {
  if (s.is_guaranteed) return { className: 'badge-confidence-standard', label: 'Standard Procedure' }
  return { className: `badge-confidence-${s.confidence}`, label: CONFIDENCE_LABEL[s.confidence] }
}

function requiresJustification(action, confidence) {
  return action === 'override' || confidence === 'amber' || confidence === 'red'
}

function SuggestionPanel({ complaintId, onDecisionRecorded }) {
  const [suggestions, setSuggestions] = useState([])
  const [recommendedWorkflow, setRecommendedWorkflow] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activeClause, setActiveClause] = useState(null)
  const [activeAction, setActiveAction] = useState(null)
  const [justification, setJustification] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [decidedClauses, setDecidedClauses] = useState({})

  useEffect(() => {
    let cancelled = false
    api
      .get(`/api/v1/complaints/${complaintId}/suggestions`)
      .then(({ data }) => {
        if (!cancelled) {
          setSuggestions(data.suggestions)
          setRecommendedWorkflow(data.recommended_workflow)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load suggestions.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [complaintId])

  function startAction(suggestion, action) {
    setError('')
    setActiveClause(suggestion.clause)
    setActiveAction(action)
    setJustification('')
  }

  function cancelAction() {
    setActiveClause(null)
    setActiveAction(null)
    setJustification('')
  }

  async function submitDecision(suggestion) {
    if (requiresJustification(activeAction, suggestion.confidence) && !justification.trim()) {
      setError('A justification is required for this decision.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/api/v1/complaints/${complaintId}/suggestion-decision`, {
        action: activeAction,
        clause: suggestion.clause,
        confidence: suggestion.confidence,
        justification: justification.trim() || null,
      })
      setDecidedClauses((prev) => ({ ...prev, [suggestion.clause]: activeAction }))
      cancelAction()
      onDecisionRecorded?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record decision.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="list-row-sub">Loading suggestions…</p>
  if (error && suggestions.length === 0) return <div className="banner-error">{error}</div>
  if (suggestions.length === 0) {
    return <p className="list-row-sub">No specific procedure found in the available policy documents.</p>
  }

  return (
    <div>
      {recommendedWorkflow.length > 0 && (
        <div className="suggestion-card" style={{ background: 'var(--color-primary-soft, #eef2ff)', marginBottom: 12 }}>
          <strong style={{ fontSize: '0.9rem' }}>Recommended System Workflow</strong>
          <p className="list-row-sub" style={{ margin: '4px 0 10px' }}>
            UACMS's own summary of the process, paraphrased from the policy text below — not a verbatim policy quote.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {recommendedWorkflow.map((step) => (
              <li key={step.title} style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                {step.title}
                <span className="list-row-sub"> — {step.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.map((s) => (
        <div key={s.clause} className="suggestion-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <strong style={{ fontSize: '0.9rem' }}>{s.clause}</strong>
            <span className={`badge ${badgeInfo(s).className}`}>{badgeInfo(s).label}</span>
          </div>
          <div className="list-row-sub" style={{ marginBottom: 6 }}>{s.source}</div>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 8px' }}>{s.text}</p>
          <p className="list-row-sub" style={{ fontStyle: 'italic', margin: '0 0 10px' }}>Why this matched: {s.why_matched}</p>

          {decidedClauses[s.clause] ? (
            <div className="list-row-sub">
              ✓ {decidedClauses[s.clause] === 'accept' ? 'Accepted' : decidedClauses[s.clause] === 'modify' ? 'Modified' : 'Overridden'}
            </div>
          ) : activeClause === s.clause ? (
            <div>
              {requiresJustification(activeAction, s.confidence) && (
                <div className="field" style={{ marginBottom: 8 }}>
                  <label htmlFor={`justification-${s.clause}`}>Justification (required)</label>
                  <textarea
                    id={`justification-${s.clause}`}
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Why are you overriding, or modifying a lower-confidence suggestion?"
                  />
                </div>
              )}
              {error && <div className="banner-error" style={{ marginBottom: 8 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={cancelAction} disabled={submitting}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => submitDecision(s)} disabled={submitting}>
                  {submitting ? 'Saving…' : `Confirm ${activeAction}`}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => startAction(s, 'accept')}>
                Accept
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => startAction(s, 'modify')}>
                Modify
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => startAction(s, 'override')}>
                Override
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default SuggestionPanel
