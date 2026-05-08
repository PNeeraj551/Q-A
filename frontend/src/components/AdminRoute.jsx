import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from './ProtectedRoute'

export default function AdminRoute({ children }) {
  const { user } = useAuth()

  return (
    <ProtectedRoute>
      {user && user.role !== 'admin' ? (
        <Navigate to="/participant/qna" replace />
      ) : (
        children
      )}
    </ProtectedRoute>
  )
}
