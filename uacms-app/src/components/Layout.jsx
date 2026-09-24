import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Sidebar from './Sidebar.jsx'

function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="app-shell">
      <Navbar onToggleSidebar={() => setSidebarCollapsed((v) => !v)} sidebarCollapsed={sidebarCollapsed} />
      <div className="app-body">
        <Sidebar collapsed={sidebarCollapsed} />
        <Outlet />
      </div>
    </div>
  )
}

export default Layout
