import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import QnaDashboard from './pages/admin/QnaDashboard'
import QnaCreatePage from './pages/admin/QnaCreatePage'
import QnaEditPage from './pages/admin/QnaEditPage'
import QnaDetailPage from './pages/admin/QnaDetailPage'
import UsersPage from './pages/admin/UsersPage'
import AnalyticsPage from './pages/admin/AnalyticsPage'
import QnaListPage from './pages/participant/QnaListPage'
import QnaFeedPage from './pages/participant/QnaFeedPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes */}
          <Route path="/admin/qna" element={<AdminRoute><QnaDashboard /></AdminRoute>} />
          <Route path="/admin/qna/create" element={<AdminRoute><QnaCreatePage /></AdminRoute>} />
          <Route path="/admin/qna/:id/edit" element={<AdminRoute><QnaEditPage /></AdminRoute>} />
          <Route path="/admin/qna/:id" element={<AdminRoute><QnaDetailPage /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />

          {/* Participant routes */}
          <Route path="/participant/qna" element={<ProtectedRoute><QnaListPage /></ProtectedRoute>} />
          <Route path="/participant/qna/:id" element={<ProtectedRoute><QnaFeedPage /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
      <Toaster position="bottom-right" toastOptions={{ duration: 3500 }} />
    </BrowserRouter>
  )
}
