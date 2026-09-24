import { formatStatus } from '../utils/complaintFormat.js'

function formatEvent(event) {
  if (event.event_type === 'status_change') {
    if (!event.from_status) return `Complaint created with status "${formatStatus(event.to_status)}"`
    return `Status changed from "${formatStatus(event.from_status)}" to "${formatStatus(event.to_status)}"`
  }
  return event.note
}

function TimelineLog({ events }) {
  if (!events || events.length === 0) {
    return <p className="list-row-sub">No activity yet.</p>
  }

  return (
    <div className="timeline-log">
      {events.map((event) => (
        <div key={event.id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.85rem' }}>{formatEvent(event)}</div>
          <div className="list-row-sub">{new Date(event.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

export default TimelineLog
