import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { changePassword, getMe } from '../api/auth'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { inputCls, errorInputCls } from '@/lib/ui'

function PasswordField({ id, label, value, onChange, error, disabled, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`${inputCls} pr-9 ${error ? errorInputCls : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

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
    if (!currentPassword) errs.currentPassword = 'Current password is required'
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
        setServerError('Current password is incorrect')
      } else {
        setServerError(err.response?.data?.message || 'Something went wrong. Please try again.')
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-xl shadow-sm border border-border p-8">
          <div className="mb-6">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-4.5 h-4.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Set new password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You must change your temporary password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <PasswordField
              id="currentPassword"
              label="Temporary password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              error={errors.currentPassword}
              disabled={loading}
              placeholder="Enter temporary password"
              autoComplete="current-password"
            />
            <PasswordField
              id="newPassword"
              label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={errors.newPassword}
              disabled={loading}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
            />
            <PasswordField
              id="confirmPassword"
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              disabled={loading}
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />

            {serverError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
                </svg>
                {serverError}
              </div>
            )}

            <Button type="submit" className="w-full">
              Set new password
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out instead
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          &copy; {new Date().getFullYear()} AthivaTech. All rights reserved.
        </p>
      </div>
    </div>
  )
}
