import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '@/components/Button'
import { Label } from '@/components/Label'
import { inputCls, errorInputCls } from '@/lib/ui'
import { FormError } from '@/components/feedback/FormError'
import { Heading } from '@/components/Heading'
import { Text } from '@/components/Text'
import { Stack } from '@/components/Stack'
import { PasswordInput } from '@/components/PasswordInput'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  function validate() {
    const errs = {}
    if (!email.trim()) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address'
    }
    if (!password) {
      errs.password = 'Password is required'
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (loadingRef.current) return
    setErrors({})
    loadingRef.current = true
    setLoading(true)
    try {
      const userData = await login(email.trim(), password)
      if (userData.must_change_password) {
        navigate('/change-password', { replace: true })
      } else if (userData.role === 'admin') {
        navigate('/admin/qna', { replace: true })
      } else {
        navigate('/user/qna', { replace: true })
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 401) {
        setServerError('Incorrect email or password.')
      } else if (status === 429) {
        setServerError('Too many attempts. Please wait a few minutes and try again.')
      } else if (!err.response) {
        setServerError('Unable to connect. Please check your internet connection.')
      } else {
        setServerError(err.response?.data?.message || 'An unexpected error occurred.')
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-indigo-50/40 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/70 border border-slate-200/80 p-8">
          <div className="mb-7">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-5 shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <Heading level={1}>Welcome back</Heading>
            <Text size="sm" className="mt-1.5 leading-relaxed">Sign in to access Q&A Platform</Text>
          </div>

          <Stack as="form" gap={5} onSubmit={handleSubmit} noValidate>
            <Stack gap={1.5}>
              <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@company.com"
                disabled={loading}
                className={`${inputCls} ${errors.email ? errorInputCls : ''}`}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </Stack>

            <Stack gap={1.5}>
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                error={errors.password}
                autoComplete="current-password"
              />
            </Stack>

            <FormError message={serverError} />

            <Button
              type="submit"
              className="w-full h-10 font-semibold"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>

          <div className="border-t border-slate-100 mt-6 pt-4">
            <Text size="xs" color="muted" className="text-center">
              &copy; {new Date().getFullYear()} AthivaTech. All rights reserved.
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
