import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Phase 2+ placeholder: admin routes */}
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Admin area — coming in next phases</p>
                </div>
              </AdminRoute>
            }
          />

          {/* Phase 2+ placeholder: participant routes */}
          <Route
            path="/sessions/*"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">Participant area — coming in next phases</p>
                </div>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
