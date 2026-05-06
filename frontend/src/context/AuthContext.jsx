import { createContext, useContext, useEffect, useState } from 'react'
import { login as loginApi, getMe, logout as logoutApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('jwt')
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        localStorage.removeItem('jwt')
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  async function login(email, password) {
    const res = await loginApi(email, password)
    const { token, user: userData } = res.data
    localStorage.setItem('jwt', token)
    setUser(userData)
    return userData
  }

  async function logout() {
    try {
      await logoutApi()
    } catch {
      // stateless logout — clear regardless
    }
    localStorage.removeItem('jwt')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
