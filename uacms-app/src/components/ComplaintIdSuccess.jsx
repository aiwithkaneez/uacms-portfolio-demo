import { useState } from 'react'

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.setAttribute('readonly', '')
    input.style.position = 'absolute'
    input.style.left = '-9999px'
    document.body.appendChild(input)
    input.select()
    const ok = document.execCommand('copy')
    input.remove()
    return ok
  }
}

function ComplaintIdSuccess({ caseId, children }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyText(caseId)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="complaint-id-success">
      <div className="complaint-id-check" aria-hidden="true">
        ✓
      </div>
      <h2>Complaint Submitted</h2>
      <p className="complaint-id-label">Your Complaint ID</p>
      <div className="complaint-id-value">{caseId}</div>
      <button type="button" className="btn btn-outline" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy Complaint ID'}
      </button>
      <p className="complaint-id-note">Save this ID.</p>
      {children}
    </div>
  )
}

export default ComplaintIdSuccess
