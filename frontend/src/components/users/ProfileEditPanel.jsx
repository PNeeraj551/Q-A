import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { updateMe } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { inputCls } from '@/utils/ui'

export default function ProfileEditPanel({ onClose }) {
  const { user, setUser } = useAuth()
  const popoverRef = useRef(null)
  const [name, setName] = useState(user?.name || '')
  const [nameError, setNameError] = useState('')
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const trimmed = name.trim()
    if (!trimmed) { setNameError('Name is required'); return }
    if (trimmed.length > 80) { setNameError('Name must be 80 characters or fewer'); return }
    if (trimmed === (user?.name || '').trim()) { onClose(); return }
    if (loadingRef.current) return
    setNameError('')
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await updateMe({ name: trimmed })
      setUser(res.data.data ?? res.data)
      toast.success('Profile updated.')
      onClose()
    } catch (err) {
      setServerError(err.response?.data?.error || err.response?.data?.message || 'Failed to save changes.')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const initial = (name || user?.name)?.[0]?.toUpperCase() || '?'

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Edit Profile"
      className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-4 space-y-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Avatar + user info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm select-none shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{name || user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
            {user?.role}
          </span>
        </div>
      </div>

      {user?.role === 'admin' ? (
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          {serverError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Name</label>
            <input
              className={`${inputCls} text-sm`}
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
              disabled={loading}
              placeholder="Full name"
              autoComplete="name"
              autoFocus
            />
            {nameError && <p className="text-xs text-red-500">{nameError}</p>}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">Profile details can only be updated by an admin.</p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
