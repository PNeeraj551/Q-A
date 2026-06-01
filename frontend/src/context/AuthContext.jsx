import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { verifyOtp as verifyOtpApi, getMe, logout as logoutApi } from '../api/auth'
import { setAuthToken } from '../api/axiosInstance'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    function handleUnauthorized() {
      setAuthToken(null)
      setUser(null)
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [navigate])

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function verifyOtp(email, otp) {
    const res = await verifyOtpApi(email, otp)
    const { token, user: userData } = res.data
    setAuthToken(token)
    setUser(userData)
    return userData
  }

  async function logout() {
    try {
      await logoutApi()
    } catch {
      // cookie cleared by backend
    }
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
