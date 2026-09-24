import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ChangePasswordModal from './ChangePasswordModal.jsx'

function Navbar({ onToggleSidebar, sidebarCollapsed }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  function handleLogout() {
    logout()
    navigate('/staff/login')
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="navbar-brand">
          <span className="navbar-logo-chip" aria-hidden="true">U</span>
          <span>UACMS</span>
        </div>
      </div>
      <div className="navbar-user">
        <span className="navbar-user-email">{user.fullName || user.email}</span>
        <span className="role-badge">{user.role}</span>
        <button className="navbar-logout" onClick={() => setShowPasswordModal(true)}>
          Change Password
        </button>
        <button className="navbar-logout navbar-logout-primary" onClick={handleLogout}>
          Log out
        </button>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </header>
  )
}

export default Navbar
