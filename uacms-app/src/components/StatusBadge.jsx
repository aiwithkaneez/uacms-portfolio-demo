const STATUS_CLASS = {
  New: 'badge-new',
  'In Progress': 'badge-progress',
  Resolved: 'badge-resolved',
  Closed: 'badge-closed',
}

function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_CLASS[status] || 'badge-new'}`}>{status}</span>
}

export default StatusBadge
