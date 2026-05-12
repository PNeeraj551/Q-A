import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { inputCls, textareaCls, errorInputCls } from '@/lib/ui'
import { createQna } from '../../api/qna'
import { getUsers } from '../../api/users'
import { useDebounce } from '../../hooks/useDebounce'

export default function QnaCreatePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('PUBLIC')
  const [endAt, setEndAt] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [errors, setErrors] = useState({})

  const debouncedSearch = useDebounce(userSearch, 300)

  useEffect(() => {
    if (visibility !== 'PRIVATE') return
    if (debouncedSearch.trim().length < 2) { setUserResults([]); return }
    getUsers(debouncedSearch.trim())
      .then((res) => setUserResults((res.data.users || []).filter((u) => u.role === 'user')))
      .catch(() => {})
  }, [debouncedSearch, visibility])

  function toggleUser(user) {
    setSelectedUsers((prev) => {
      const exists = prev.find((p) => p._id === user._id)
      return exists ? prev.filter((p) => p._id !== user._id) : [...prev, user]
    })
  }

  function validate() {
    const errs = {}
    if (!title.trim()) errs.title = 'Title is required'
    else if (title.trim().length > 120) errs.title = 'Title must be 120 characters or fewer'
    const todayMin = new Date().toISOString().slice(0, 10) + 'T00:00'
    if (endAt && new Date(endAt) < new Date(todayMin)) errs.endAt = 'Close date cannot be before today'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (submittingRef.current) return
    setErrors({})
    submittingRef.current = true
    setSubmitting(true)
    try {
      await createQna({
        title: title.trim(),
        description: description.trim(),
        visibility,
        allowed_users: visibility === 'PRIVATE' ? selectedUsers.map((u) => u._id) : [],
        end_at: endAt ? new Date(endAt).toISOString() : null,
      })
      navigate('/admin/qna')
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to create Q&A.' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout title="Create Q&A Post" onBack={() => navigate('/admin/qna')}>
      <div className="max-w-2xl">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-slate-700 font-medium">
                Title <span className="text-red-500">*</span>
              </Label>
              <input
                id="title"
                className={`${inputCls} ${errors.title ? errorInputCls : ''}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Product Roadmap Discussion"
                maxLength={120}
                disabled={submitting}
              />
              {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-slate-700 font-medium">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <textarea
                id="description"
                className={`${textareaCls} min-h-[80px]`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional context or instructions for users..."
                maxLength={1000}
                rows={3}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Visibility</Label>
              <div className="flex gap-2">
                {['PUBLIC', 'PRIVATE'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all duration-200 ${
                      visibility === v
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {v === 'PUBLIC' ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    )}
                    {v === 'PUBLIC' ? 'Public' : 'Private'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {visibility === 'PUBLIC'
                  ? 'All users can see and join this Q&A.'
                  : 'Only assigned users can see this Q&A.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">
                Auto-close at <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <input
                type="datetime-local"
                className={`${inputCls} ${errors.endAt ? errorInputCls : ''}`}
                value={endAt}
                min={new Date().toISOString().slice(0, 10) + 'T00:00'}
                onChange={(e) => setEndAt(e.target.value)}
                disabled={submitting}
              />
              {errors.endAt && <p className="text-xs text-red-500">{errors.endAt}</p>}
              <p className="text-xs text-slate-400">
                If set, the Q&A will automatically close at this date and time.
              </p>
            </div>

            {visibility === 'PRIVATE' && (
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Assign Users</Label>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map((u) => (
                      <span
                        key={u._id}
                        className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-3 py-1 rounded-full font-medium"
                      >
                        {u.name}
                        <button
                          type="button"
                          onClick={() => toggleUser(u)}
                          className="text-blue-400 hover:text-red-500 transition-colors duration-200 leading-none"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  className={inputCls}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name or email..."
                />
                {userResults.filter((u) => !selectedUsers.find((p) => p._id === u._id)).length > 0 && (
                  <div className="border border-slate-200 rounded-2xl shadow-lg divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white">
                    {userResults
                      .filter((u) => !selectedUsers.find((p) => p._id === u._id))
                      .map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => toggleUser(u)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-sm text-left transition-colors duration-200"
                        >
                          <span className="font-medium text-slate-900">{u.name}</span>
                          <span className="text-slate-400 text-xs">{u.email}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="h-10">
                Create Q&A
              </Button>
              <Button type="button" variant="outline" className="h-10" onClick={() => navigate('/admin/qna')}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
