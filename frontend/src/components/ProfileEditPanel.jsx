import { useState, useEffect, useRef } from 'react'
import { updateMe } from '../api/auth'
import { useAuth } from '../context/AuthContext'

function Avatar({ name, size = 'xl' }) {
  const initial = name?.[0]?.toUpperCase() || '?'
  const sz =
    size === 'xl' ? 'w-16 h-16 text-2xl' :
    size === 'lg' ? 'w-10 h-10 text-base' :
    'w-8 h-8 text-sm'
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold select-none shrink-0`}>
      {initial}
    </div>
  )
}

function InputField({ id, label, type = 'text', value, onChange, error, disabled, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
            error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
          } disabled:opacity-60`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
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
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
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
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
    setSuccess(false)
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
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
      onClose()
    } catch (err) {
      setServerError(err.response?.data?.error || err.response?.data?.message || 'Failed to save changes.')
    } finally {
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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Profile"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit Profile</h2>
            <p className="text-xs text-gray-400 mt-0.5">Update your personal information</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <Avatar name={name || user?.name} size="xl" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{name || user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              {memberSince && <p className="text-xs text-gray-400 mt-0.5">Member since {memberSince}</p>}
            </div>
          </div>

          {success && (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs font-semibold text-emerald-700">Profile updated successfully!</p>
            </div>
          )}

          {serverError && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
              <p className="text-xs text-red-600">{serverError}</p>
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

            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setChangePassword(v => !v); setErrors({}); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}
                className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${changePassword ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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

        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="profile-form"
            disabled={loading || !hasChanges}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
