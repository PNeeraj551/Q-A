import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AdminRoute from './components/common/AdminRoute'
import { ErrorBoundary } from './components/common/ErrorBoundary'

const LoginPage          = lazy(() => import('./pages/auth/LoginPage'))
const ChangePasswordPage = lazy(() => import('./pages/auth/ChangePasswordPage'))
const QnaDashboard       = lazy(() => import('./pages/admin/QnaDashboardPage'))
const QnaCreatePage      = lazy(() => import('./pages/admin/QnaCreatePage'))
const QnaEditPage        = lazy(() => import('./pages/admin/QnaEditPage'))
const QnaDetailPage      = lazy(() => import('./pages/admin/QnaDetailPage'))
const UsersPage          = lazy(() => import('./pages/admin/UsersPage'))
const AnalyticsPage      = lazy(() => import('./pages/admin/AnalyticsPage'))
const QnaListPage        = lazy(() => import('./pages/user/QnaListPage'))
const QnaFeedPage        = lazy(() => import('./pages/user/QnaDetailPage'))

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
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

            {/* User routes */}
            <Route path="/user/qna" element={<ProtectedRoute><QnaListPage /></ProtectedRoute>} />
            <Route path="/user/qna/:id" element={<ProtectedRoute><QnaFeedPage /></ProtectedRoute>} />

            {/* Shared */}
            <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </AuthProvider>
      <Toaster position="bottom-right" toastOptions={{ duration: 3500 }} />
    </BrowserRouter>
  )
}
