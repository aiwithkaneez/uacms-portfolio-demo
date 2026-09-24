import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client.js'
import { clearStoredToken, getStoredToken, setStoredToken } from '../api/authStorage.js'

const AuthContext = createContext(null)

export const ROLES = {
  EMPLOYEE: 'Employee',
  DESK_OWNER: 'Desk Owner',
  EXECUTIVE: 'Executive',
  KB_ADMIN: 'Knowledge Base Admin',
  SYSTEM_ADMIN: 'System Admin',
}

export const ROLE_HOME = {
  [ROLES.EMPLOYEE]: '/employee/dashboard',
  [ROLES.DESK_OWNER]: '/deskowner/dashboard',
  [ROLES.EXECUTIVE]: '/executive/reports',
  [ROLES.KB_ADMIN]: '/kb-admin/knowledge-base',
  [ROLES.SYSTEM_ADMIN]: '/admin/users',
}

// Who can see the Executive reports dashboard. KB Admin used to be lumped
// in here too, landing on the exact same page as Executive - fixed by
// giving KB Admin its own Knowledge Base page instead (see
// pages/KnowledgeBase.jsx). System Admin keeps read access to reports on
// top of their own User Management page.
export const EXECUTIVE_ROLES = [ROLES.EXECUTIVE, ROLES.SYSTEM_ADMIN]

function mapUserFromMe(data) {
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    fullName: data.full_name,
    assignedDesk: data.assigned_desk,
    isActive: data.is_active,
  }
}

function mapUserFromLogin(data, email) {
  return {
    email,
    role: data.role,
    fullName: data.full_name,
    assignedDesk: data.assigned_desk,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      if (!getStoredToken()) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const { data } = await api.get('/api/v1/auth/me')
        if (!cancelled) setUser(mapUserFromMe(data))
      } catch {
        clearStoredToken()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    function handleAuthExpired() {
      setUser(null)
    }

    restoreSession()
    window.addEventListener('uacms:auth-expired', handleAuthExpired)
    return () => {
      cancelled = true
      window.removeEventListener('uacms:auth-expired', handleAuthExpired)
    }
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/api/v1/auth/login', { email, password })
    setStoredToken(data.access_token)
    const nextUser = mapUserFromLogin(data, email)
    setUser(nextUser)
    return nextUser
  }

  function logout() {
    clearStoredToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
