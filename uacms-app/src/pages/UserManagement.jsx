import { useEffect, useMemo, useState } from 'react'
import api from '../api/client.js'

const ROLE_OPTIONS = ['Employee', 'Desk Owner', 'Executive', 'Knowledge Base Admin', 'System Admin']
const DESK_OPTIONS = ['Operations', 'HR Employee Relations', 'HR Learning', 'FIU']
const NAME_REGEX = /^[A-Za-z' -]{2,80}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function roleToPillClass(role) {
  return `role-pill role-pill-${role.toLowerCase().replace(/\s+/g, '-')}`
}

function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(ROLE_OPTIONS[0])
  const [assignedDesk, setAssignedDesk] = useState(DESK_OPTIONS[0])
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdUser, setCreatedUser] = useState(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All Roles')
  const [togglingId, setTogglingId] = useState(null)

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/v1/users')
      setUsers(data)
    } catch {
      setError('Could not load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (creating) return

    setCreateError('')

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      setCreateError('Full name cannot be empty.')
      return
    }
    if (trimmedName.length > 80) {
      setCreateError('Full name is too long.')
      return
    }
    if (!NAME_REGEX.test(trimmedName)) {
      setCreateError('Full name can only contain letters, spaces, hyphens, and apostrophes.')
      return
    }
    if (!trimmedEmail) {
      setCreateError('Email cannot be empty.')
      return
    }
    if (trimmedEmail.length > 254) {
      setCreateError('Email is too long.')
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setCreateError('Please enter a valid email address.')
      return
    }

    setCreating(true)
    try {
      const { data } = await api.post('/api/v1/users', {
        full_name: trimmedName,
        email: trimmedEmail,
        role,
        assigned_desk: role === 'Desk Owner' ? assignedDesk : null,
      })
      setCreatedUser(data)
      setFullName('')
      setEmail('')
      setRole(ROLE_OPTIONS[0])
      setAssignedDesk(DESK_OPTIONS[0])
      await loadUsers()
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Could not create user.')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(user) {
    if (togglingId) return
    setTogglingId(user.id)
    try {
      await api.patch(`/api/v1/users/${user.id}`, { is_active: !user.is_active })
      await loadUsers()
    } catch {
      setError(`Could not update ${user.full_name}.`)
    } finally {
      setTogglingId(null)
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchesSearch =
        !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      const matchesRole = roleFilter === 'All Roles' || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const hasActiveFilters = search.trim() !== '' || roleFilter !== 'All Roles'

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>User Management</h1>
          <p>Create accounts and manage roles for the complaint portal.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {showCreateForm && (
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
          {createError && <div className="banner-error">{createError}</div>}

          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={80} />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} />
          </div>

          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {role === 'Desk Owner' && (
            <div className="field">
              <label htmlFor="assignedDesk">Assigned desk</label>
              <select id="assignedDesk" value={assignedDesk} onChange={(e) => setAssignedDesk(e.target.value)}>
                {DESK_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create User'}
          </button>
        </form>
      )}

      {createdUser && (
        <div className="card" style={{ marginBottom: 20, background: '#eef7ee' }}>
          <strong>{createdUser.full_name}</strong> created. Temporary password (shown only once — share it
          securely, they can change it after logging in):
          <div style={{ fontFamily: 'monospace', fontSize: '1rem', marginTop: 8 }}>{createdUser.temp_password}</div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 16px 4px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>All Users</h3>
        </div>

        <div className="filter-bar">
          <input
            className="filter-search"
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users by name or email"
          />
          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
          >
            <option>All Roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {!loading && !error && (
          <div className="filter-result-count">
            {filteredUsers.length} of {users.length} user{users.length === 1 ? '' : 's'}
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            Loading users…
          </div>
        )}

        {!loading && error && (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <div className="empty-state-title">{error}</div>
            <div className="empty-state-hint">Try refreshing the page.</div>
          </div>
        )}

        {!loading && !error && filteredUsers.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">
              {hasActiveFilters ? 'No users match your search' : 'No users yet'}
            </div>
            <div className="empty-state-hint">
              {hasActiveFilters
                ? 'Try a different name, email, or role filter.'
                : 'Create the first account using the button above.'}
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          filteredUsers.map((u) => (
            <div key={u.id} className="list-row user-row">
              <div className="list-row-main">
                <span className="list-row-title">
                  {u.full_name}
                  <span className={roleToPillClass(u.role)}>{u.role}</span>
                  <span className={`status-pill ${u.is_active ? 'status-pill-active' : 'status-pill-inactive'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </span>
                <span className="list-row-sub">
                  {u.email}
                  {u.assigned_desk && ` · ${u.assigned_desk}`}
                </span>
              </div>
              <div className="list-row-right">
                <button className="btn btn-outline btn-sm" onClick={() => toggleActive(u)} disabled={togglingId === u.id}>
                  {togglingId === u.id ? 'Saving…' : u.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default UserManagement