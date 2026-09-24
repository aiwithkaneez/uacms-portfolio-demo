import { Navigate } from 'react-router-dom'
import { useAuth, ROLE_HOME } from '../context/AuthContext.jsx'

function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="login-wrap">
        <p className="subtitle">Restoring session…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/staff/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />
  }

  return children
}

export default ProtectedRoute
