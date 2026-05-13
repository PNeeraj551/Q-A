import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { changePassword, getMe } from '../api/auth'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/feedback/FormError'
import { Heading } from '@/components/Heading'
import { Text } from '@/components/Text'
import { Stack } from '@/components/Stack'
import { PasswordInput } from '@/components/PasswordInput'

export default function ChangePasswordPage() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  function validate() {
    const errs = {}
    if (!currentPassword) errs.currentPassword = 'Temporary password is required'
    if (!newPassword) {
      errs.newPassword = 'New password is required'
    } else if (newPassword.length < 6) {
      errs.newPassword = 'New password must be at least 6 characters'
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your new password'
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
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
      await changePassword(currentPassword, newPassword)
      const res = await getMe()
      setUser(res.data)
      navigate(user?.role === 'admin' ? '/admin/qna' : '/user/qna', { replace: true })
    } catch (err) {
      const status = err.response?.status
      if (status === 401) {
        setServerError('Current password is incorrect.')
      } else {
        setServerError(err.response?.data?.message || 'Something went wrong. Please try again.')
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/50 to-indigo-50/40 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/70 border border-slate-200/80 p-8">
          <div className="mb-6">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-5 shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <Heading level={1}>Set new password</Heading>
            <Text size="13" className="mt-1.5 leading-relaxed">
              You must change your temporary password to continue.
            </Text>
          </div>

          <Stack as="form" gap={4} onSubmit={handleSubmit} noValidate>
            <Stack gap={1.5}>
              <Label htmlFor="currentPassword">Temporary password</Label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={errors.currentPassword}
                disabled={loading}
                placeholder="Enter temporary password"
                autoComplete="current-password"
              />
            </Stack>
            <Stack gap={1.5}>
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={errors.newPassword}
                disabled={loading}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />
            </Stack>
            <Stack gap={1.5}>
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                disabled={loading}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </Stack>

            <FormError message={serverError} />

            <Button type="submit" className="w-full">
              Set new password
            </Button>
          </Stack>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={logout}
              className="text-sm text-slate-400 hover:text-slate-700 transition-colors duration-200"
            >
              Sign out instead
            </button>
          </div>
        </div>

        <Text size="xs" color="muted" className="text-center mt-6">
          &copy; {new Date().getFullYear()} AthivaTech. All rights reserved.
        </Text>
      </div>
    </div>
  )
}
