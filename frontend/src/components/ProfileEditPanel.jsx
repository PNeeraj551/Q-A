import { useState, useEffect, useRef } from 'react'
import { updateMe } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function InputField({ id, label, type = 'text', value, onChange, error, disabled, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={isPassword ? 'pr-10' : ''}
        />
        {isPassword && (
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
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default function ProfileEditPanel({ onClose }) {
  const { user, setUser } = useAuth()
  const panelRef = useRef(null)

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [emailDirty, setEmailDirty] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePassword, setChangePassword] = useState(false)

  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true))
  }, [])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleClose() {
    setOpen(false)
    setTimeout(onClose, 250)
  }

  function validate() {
    const errs = {}
    if (!name.trim()) errs.name = 'Name is required'
    else if (name.trim().length > 80) errs.name = 'Name must be 80 characters or fewer'
    if (emailDirty) {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'A valid email is required'
    }
    if (changePassword) {
      if (!currentPassword) errs.currentPassword = 'Current password is required'
      if (!newPassword || newPassword.length < 6) errs.newPassword = 'New password must be at least 6 characters'
      if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (!hasChanges || loadingRef.current) return
    setErrors({})
    loadingRef.current = true
    setLoading(true)
    try {
      const payload = {}
      if (name.trim() !== (user?.name || '').trim()) payload.name = name.trim()
      if (emailDirty && email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase()) payload.email = email.trim().toLowerCase()
      if (changePassword) {
        payload.currentPassword = currentPassword
        payload.newPassword = newPassword
        payload.confirmPassword = confirmPassword
      }
      const res = await updateMe(payload)
      setUser(res.data.data ?? res.data)
      handleClose()
    } catch (err) {
      setServerError(err.response?.data?.error || err.response?.data?.message || 'Failed to save changes.')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const hasChanges = name.trim() !== (user?.name || '').trim() ||
    (emailDirty && email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase()) ||
    changePassword

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null

  return (
    <>
      <div
        onClick={handleClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-250 ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Profile"
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-250 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Edit Profile</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Update your personal information</p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-4 pb-5 border-b border-border">
            <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl select-none shrink-0">
              {(name || user?.name)?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{name || user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              {memberSince && <p className="text-xs text-muted-foreground mt-0.5">Member since {memberSince}</p>}
            </div>
          </div>

          {serverError && (
            <div className="flex items-center gap-2.5 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-destructive shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
              <p className="text-xs text-destructive">{serverError}</p>
            </div>
          )}

          <form id="profile-form" onSubmit={handleSubmit} noValidate className="space-y-4">
            <InputField
              id="profile-name"
              label="Full Name"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
              error={errors.name}
              disabled={loading}
              placeholder="Your full name"
              autoComplete="name"
            />

            <InputField
              id="profile-email"
              label="Email Address"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailDirty(true); setErrors(p => ({ ...p, email: '' })) }}
              error={errors.email}
              disabled={loading}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => { setChangePassword(v => !v); setErrors({}); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}
                className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${changePassword ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {changePassword ? 'Cancel password change' : 'Change password'}
              </button>

              {changePassword && (
                <div className="mt-4 space-y-4">
                  <InputField
                    id="profile-current-password"
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={e => { setCurrentPassword(e.target.value); setErrors(p => ({ ...p, currentPassword: '' })) }}
                    error={errors.currentPassword}
                    disabled={loading}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <InputField
                    id="profile-new-password"
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setErrors(p => ({ ...p, newPassword: '' })) }}
                    error={errors.newPassword}
                    disabled={loading}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                  />
                  <InputField
                    id="profile-confirm-password"
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })) }}
                    error={errors.confirmPassword}
                    disabled={loading}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-border bg-muted/30 flex gap-3">
          <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="profile-form" className="flex-1">
            Save Changes
          </Button>
        </div>
      </div>
    </>
  )
}
