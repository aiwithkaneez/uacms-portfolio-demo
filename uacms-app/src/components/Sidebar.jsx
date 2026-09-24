import { NavLink } from 'react-router-dom'
import { useAuth, ROLES } from '../context/AuthContext.jsx'

const NAV_BY_ROLE = {
  [ROLES.EMPLOYEE]: [
    { to: '/employee/dashboard', label: 'Dashboard' },
    { to: '/employee/submit', label: 'Submit Complaint' },
    { to: '/employee/track', label: 'Track Complaint' },
  ],
  [ROLES.DESK_OWNER]: [
    { to: '/deskowner/dashboard', label: 'Dashboard' },
    { to: '/deskowner/queue', label: 'Assigned Complaints' },
  ],
  [ROLES.EXECUTIVE]: [{ to: '/executive/reports', label: 'Reports & Analytics' }],
  [ROLES.KB_ADMIN]: [{ to: '/kb-admin/knowledge-base', label: 'Knowledge Base' }],
  [ROLES.SYSTEM_ADMIN]: [
    { to: '/admin/users', label: 'User Management' },
    { to: '/admin/complaints', label: 'Complaint Oversight' },
  ],
}

function Sidebar({ collapsed }) {
  const { user } = useAuth()
  const links = NAV_BY_ROLE[user.role] || []

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="sidebar-section-label">{user.role}</div>
      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
