const STEPS = ['New', 'In Progress', 'Resolved', 'Closed']

function ComplaintTimeline({ status }) {
  const currentIndex = STEPS.indexOf(status)
  return (
    <div className="timeline">
      {STEPS.map((step, i) => {
        let cls = ''
        if (i < currentIndex) cls = 'done'
        else if (i === currentIndex) cls = 'current'
        return (
          <div className={`timeline-step ${cls}`} key={step}>
            <div className="timeline-dot">
              <div className="timeline-line" />
            </div>
            <div className="timeline-label">{step}</div>
          </div>
        )
      })}
    </div>
  )
}

export default ComplaintTimeline
