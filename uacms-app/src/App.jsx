import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth, ROLES, ROLE_HOME, EXECUTIVE_ROLES } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import PublicLanding from './pages/PublicLanding.jsx'
import EmployeeDashboard from './pages/EmployeeDashboard.jsx'
import SubmitComplaint from './pages/SubmitComplaint.jsx'
import ComplaintList from './pages/ComplaintList.jsx'
import EmployeeComplaintDetail from './pages/EmployeeComplaintDetail.jsx'
import DeskOwnerDashboard from './pages/DeskOwnerDashboard.jsx'
import AssignedComplaintsList from './pages/AssignedComplaintsList.jsx'
import ComplaintDetail from './pages/ComplaintDetail.jsx'
import ExecutiveDashboard from './pages/ExecutiveDashboard.jsx'
import KnowledgeBase from './pages/KnowledgeBase.jsx'
import UserManagement from './pages/UserManagement.jsx'
import PublicSubmitComplaint from './pages/PublicSubmitComplaint.jsx'
import PublicComplaintStatus from './pages/PublicComplaintStatus.jsx'
import AdminComplaintOversight from './pages/AdminComplaintOversight.jsx'
import AdminComplaintDetail from './pages/AdminComplaintDetail.jsx'

function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="login-wrap">
        <p className="subtitle">Restoring session…</p>
      </div>
    )
  }

  return user ? <Navigate to={ROLE_HOME[user.role] || '/'} replace /> : <PublicLanding />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/staff/login" element={<Login />} />
      <Route path="/report" element={<PublicSubmitComplaint />} />
      <Route path="/public/status" element={<PublicComplaintStatus />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.EMPLOYEE]}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/submit"
          element={
            <ProtectedRoute allowedRoles={[ROLES.EMPLOYEE]}>
              <SubmitComplaint />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/track"
          element={
            <ProtectedRoute allowedRoles={[ROLES.EMPLOYEE]}>
              <ComplaintList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/track/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.EMPLOYEE]}>
              <EmployeeComplaintDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/deskowner/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DESK_OWNER]}>
              <DeskOwnerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deskowner/queue"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DESK_OWNER]}>
              <AssignedComplaintsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deskowner/complaint/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DESK_OWNER]}>
              <ComplaintDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/executive/reports"
          element={
            <ProtectedRoute allowedRoles={EXECUTIVE_ROLES}>
              <ExecutiveDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kb-admin/knowledge-base"
          element={
            <ProtectedRoute allowedRoles={[ROLES.KB_ADMIN]}>
              <KnowledgeBase />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/complaints"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AdminComplaintOversight />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/complaint/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AdminComplaintDetail />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
