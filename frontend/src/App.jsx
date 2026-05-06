import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import SessionDashboard from './pages/admin/SessionDashboard'
import SessionCreatePage from './pages/admin/SessionCreatePage'
import LiveSessionFeed from './pages/admin/LiveSessionFeed'
import ArchivedSessionsPage from './pages/admin/ArchivedSessionsPage'
import ArchivedSessionDetails from './pages/admin/ArchivedSessionDetails'
import AvailableSessionsList from './pages/participant/AvailableSessionsList'
import SessionFeedPage from './pages/participant/SessionFeedPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes */}
          <Route
            path="/admin/sessions"
            element={
              <AdminRoute>
                <SessionDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/sessions/create"
            element={
              <AdminRoute>
                <SessionCreatePage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/sessions/:id/feed"
            element={
              <AdminRoute>
                <LiveSessionFeed />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/archive"
            element={
              <AdminRoute>
                <ArchivedSessionsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/archive/:id"
            element={
              <AdminRoute>
                <ArchivedSessionDetails />
              </AdminRoute>
            }
          />

          {/* Participant routes */}
          <Route
            path="/participant/sessions"
            element={
              <ProtectedRoute>
                <AvailableSessionsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sessions"
            element={<Navigate to="/participant/sessions" replace />}
          />
          <Route
            path="/sessions/:id"
            element={
              <ProtectedRoute>
                <SessionFeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
