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
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <input
              id="title"
              className={`${inputCls} ${errors.title ? errorInputCls : ''}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Product Roadmap Discussion"
              maxLength={120}
              disabled={submitting}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
            <Label>Visibility</Label>
            <div className="flex gap-2">
              {['PUBLIC', 'PRIVATE'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md border text-sm font-medium transition-colors ${
                    visibility === v
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
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
            <p className="text-xs text-muted-foreground">
              {visibility === 'PUBLIC'
                ? 'All users can see and join this Q&A.'
                : 'Only assigned users can see this Q&A.'}
            </p>
          </div>

          {visibility === 'PRIVATE' && (
            <div className="space-y-2">
              <Label>Assign Users</Label>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map((u) => (
                    <span
                      key={u._id}
                      className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium"
                    >
                      {u.name}
                      <button
                        type="button"
                        onClick={() => toggleUser(u)}
                        className="hover:text-destructive ml-0.5 text-primary/60"
                      >
                        ×
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
                <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto bg-card">
                  {userResults
                    .filter((u) => !selectedUsers.find((p) => p._id === u._id))
                    .map((u) => (
                      <button
                        key={u._id}
                        type="button"
                        onClick={() => toggleUser(u)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent text-sm text-left transition-colors"
                      >
                        <span className="font-medium text-foreground">{u.name}</span>
                        <span className="text-muted-foreground text-xs">{u.email}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit">
              Create Q&A
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/admin/qna')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
