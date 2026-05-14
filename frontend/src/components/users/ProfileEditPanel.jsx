import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { updateMe } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { Button } from '@/components/common/Button'
import { Label } from '@/components/common/Label'
import { inputCls } from '@/utils/ui'
import { PasswordInput } from '../common/PasswordInput'

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
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address'
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
      toast.success('Profile updated.')
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
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-250 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Edit Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">Update your personal information</p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-4 pb-5 border-b border-slate-200">
            <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl select-none shrink-0">
              {(name || user?.name)?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{name || user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              {memberSince && <p className="text-xs text-slate-400 mt-0.5">Member since {memberSince}</p>}
            </div>
          </div>

          {serverError && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
              <p className="text-xs text-red-600">{serverError}</p>
            </div>
          )}

          <form id="profile-form" onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <input
                id="profile-name"
                className={inputCls}
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
                disabled={loading}
                placeholder="Full name"
                autoComplete="name"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email address</Label>
              <input
                id="profile-email"
                type="email"
                className={inputCls}
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailDirty(true); setErrors(p => ({ ...p, email: '' })) }}
                disabled={loading}
                placeholder="email@company.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => { setChangePassword(v => !v); setErrors({}); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}
                className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${changePassword ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {changePassword ? 'Cancel password change' : 'Change password'}
              </button>

              {changePassword && (
                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-current-password">Current password</Label>
                    <PasswordInput
                      id="profile-current-password"
                      value={currentPassword}
                      onChange={e => { setCurrentPassword(e.target.value); setErrors(p => ({ ...p, currentPassword: '' })) }}
                      error={errors.currentPassword}
                      disabled={loading}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-new-password">New password</Label>
                    <PasswordInput
                      id="profile-new-password"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setErrors(p => ({ ...p, newPassword: '' })) }}
                      error={errors.newPassword}
                      disabled={loading}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-confirm-password">Confirm new password</Label>
                    <PasswordInput
                      id="profile-confirm-password"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })) }}
                      error={errors.confirmPassword}
                      disabled={loading}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
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
