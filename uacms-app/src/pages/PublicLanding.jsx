import { Link } from 'react-router-dom'

function PublicLanding() {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="login-logo" aria-hidden="true">U</div>
        <h1>UACMS</h1>
        <p className="subtitle" style={{ marginBottom: 24 }}>Complaint Portal</p>

        <Link to="/report" className="btn btn-primary btn-block" style={{ marginBottom: 12 }}>
          Report a Concern
        </Link>
        <Link to="/public/status" className="btn btn-outline btn-block">
          Check Complaint Status
        </Link>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <Link to="/staff/login" className="hint">
            Staff Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default PublicLanding
