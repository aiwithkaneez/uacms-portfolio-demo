import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth, ROLE_HOME } from '../context/AuthContext.jsx'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()

  // Already signed in and landed on /staff/login directly (bookmark, back
  // button, etc.) - skip straight to their dashboard instead of showing
  // the form again.
  if (!loading && user) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const user = await login(email, password)
      navigate(ROLE_HOME[user.role] || '/')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Login failed. Check your email and password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo" aria-hidden="true">U</div>
        <h1>UACMS</h1>
        <p className="subtitle">Complaint Portal</p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="field hint" style={{ color: '#b42318', marginBottom: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Login'}
        </button>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <Link to="/" className="hint">
            ← Public complaint portal
          </Link>
        </div>
      </form>
    </div>
  )
}

export default Login
