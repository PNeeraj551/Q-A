import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { updateMe } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { Button } from '@/components/common/Button'
import { Label } from '@/components/common/Label'
import { inputCls } from '@/utils/ui'

export default function ProfileEditPanel({ onClose }) {
  const { user, setUser } = useAuth()
  const panelRef = useRef(null)

  const [name, setName] = useState(user?.name || '')
  const [nameError, setNameError] = useState('')
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

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const trimmed = name.trim()
    if (!trimmed) { setNameError('Name is required'); return }
    if (trimmed.length > 80) { setNameError('Name must be 80 characters or fewer'); return }
    if (trimmed === (user?.name || '').trim()) { handleClose(); return }
    if (loadingRef.current) return
    setNameError('')
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await updateMe({ name: trimmed })
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
        <div className="px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Edit Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">Update your display name</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-4 pb-6">
            <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl select-none shrink-0">
              {(name || user?.name)?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-slate-900">{name || user?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
              <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize self-start">
                {user?.role}
            </span>
            </div>
          </div>

          {user?.role === 'admin' ? (
            <>
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
                    className={`${inputCls} shadow-sm`}
                    value={name}
                    onChange={e => { setName(e.target.value); setNameError('') }}
                    disabled={loading}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                  {nameError && <p className="text-xs text-red-500">{nameError}</p>}
                </div>
              </form>
            </>
          ) : (
            <p className="text-xs text-slate-400">Profile details can only be updated by an admin.</p>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 flex gap-3">
          {user?.role === 'admin' ? (
            <>
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" form="profile-form" className="flex-1" disabled={loading}>
                Save Changes
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
              Close
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
