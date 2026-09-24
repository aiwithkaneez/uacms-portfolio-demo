// Renders a mock TAT (turnaround time) countdown label from hoursRemaining.
// hoursRemaining is a hardcoded mock number per complaint — no real clock/timer logic.
function TatCountdown({ hoursRemaining, status }) {
  if (status === 'Resolved' || status === 'Closed') {
    return <span className="tat">—</span>
  }
  if (hoursRemaining <= 0) {
    return <span className="tat tat-expired">Expired</span>
  }
  if (hoursRemaining <= 6) {
    return <span className="tat tat-warn">{hoursRemaining}h left</span>
  }
  return <span className="tat tat-ok">{hoursRemaining}h left</span>
}

export default TatCountdown
