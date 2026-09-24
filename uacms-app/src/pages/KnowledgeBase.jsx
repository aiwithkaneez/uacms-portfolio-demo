import { useEffect, useMemo, useState } from 'react'
import { createPolicyChunk, getPolicyChunks, updatePolicyChunk } from '../api/knowledgeBase.js'
import PolicyChunkFormModal from '../components/PolicyChunkFormModal.jsx'

const KNOWN_CATEGORIES = ['harassment', 'whistleblow', 'grievance', 'general']

function formatCategory(category) {
  if (category === 'general') return 'General'
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function KnowledgeBase() {
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalState, setModalState] = useState(null) // { mode: 'add' | 'edit', chunk?, category? }

  async function fetchChunks() {
    try {
      setLoading(true)
      const data = await getPolicyChunks()
      setChunks(data)
      setError(null)
    } catch (err) {
      setError('Failed to load the policy knowledge base. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChunks()
  }, [])

  async function handleSave(payload) {
    if (modalState.mode === 'edit') {
      await updatePolicyChunk(modalState.chunk.id, payload)
    } else {
      await createPolicyChunk(payload)
    }
    await fetchChunks()
  }

  const grouped = useMemo(() => {
    const byCategory = {}
    for (const chunk of chunks) {
      if (!byCategory[chunk.category]) byCategory[chunk.category] = []
      byCategory[chunk.category].push(chunk)
    }
    const categories = new Set([...KNOWN_CATEGORIES, ...Object.keys(byCategory)])
    return [...categories].map((category) => ({
      category,
      items: byCategory[category] || [],
    }))
  }, [chunks])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Knowledge Base</h1>
        <p>
          The policy corpus the Policy-Based AI Recommendation Engine retrieves from when suggesting
          resolutions to desk owners.
        </p>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-primary" onClick={() => setModalState({ mode: 'add' })}>
          + Add Policy Clause
        </button>
      </div>

      {loading && <div className="card"><p>Loading…</p></div>}

      {!loading &&
        !error &&
        grouped.map(({ category, items }) => (
          <div className="card" key={category} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>{formatCategory(category)}</h3>
            {items.length === 0 && (
              <p className="list-row-sub">
                No policy clauses are indexed for this category — complaints here don't get
                AI-suggested resolutions, by design.
              </p>
            )}
            {items.map((chunk) => (
              <div className="list-row" key={chunk.id}>
                <div className="list-row-main">
                  <div className="list-row-title">
                    {chunk.clause}
                    {chunk.is_core_procedure && (
                      <span className="badge badge-confidence-standard" style={{ marginLeft: 8 }}>
                        Core Procedure
                      </span>
                    )}
                  </div>
                  <div className="list-row-sub">{chunk.text}</div>
                  <div className="list-row-sub">
                    Source: {chunk.source} · {chunk.clause_type}
                  </div>
                </div>
                <div className="list-row-right">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setModalState({ mode: 'edit', chunk })}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {modalState && (
        <PolicyChunkFormModal
          chunk={modalState.mode === 'edit' ? modalState.chunk : null}
          onClose={() => setModalState(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default KnowledgeBase
