import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/layouts/DashboardLayout'
import { Button } from '@/components/Button'
import { Label } from '@/components/Label'
import { inputCls, textareaCls, errorInputCls } from '@/lib/ui'
import { createQna } from '../../api/qna'
import { getUsers } from '../../api/users'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { UserTag } from '@/components/UserTag'
import { Surface } from '@/components/Surface'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'

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
      toast.success('Q&A board created.')
      navigate('/admin/qna')
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to create Q&A board.' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout title="New Q&A Board" onBack={() => navigate('/admin/qna')}>
      <div className="max-w-2xl">
        <Surface className="p-8 shadow-sm">
          <Stack as="form" gap={6} onSubmit={handleSubmit}>

            <Stack gap={1.5}>
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
            </Stack>

            <Stack gap={1.5}>
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
            </Stack>

            <Stack gap={1.5}>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibility === 'PRIVATE'}
                  onChange={(e) => setVisibility(e.target.checked ? 'PRIVATE' : 'PUBLIC')}
                  disabled={submitting}
                  className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer disabled:opacity-50"
                />
                <span className="text-sm font-medium text-slate-700">Private</span>
              </label>
              <Text size="xs" color="muted" className="pl-[26px]">
                {visibility === 'PRIVATE'
                  ? 'Only assigned users can see this Q&A board.'
                  : 'All users can see and join this Q&A board.'}
              </Text>
            </Stack>

            <Stack gap={1.5}>
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
              <Text size="xs" color="muted">
                If set, this Q&A board will automatically close at this date and time.
              </Text>
            </Stack>

            {visibility === 'PRIVATE' && (
              <Stack gap={2}>
                <Label className="text-slate-700 font-medium">Assign Users</Label>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map((u) => (
                      <UserTag
                        key={u._id}
                        label={u.name}
                        onRemove={() => toggleUser(u)}
                        disabled={submitting}
                      />
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
              </Stack>
            )}

            {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="h-10" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Q&A Board'}
              </Button>
              <Button type="button" variant="outline" className="h-10" onClick={() => navigate('/admin/qna')}>
                Cancel
              </Button>
            </div>
          </Stack>
        </Surface>
      </div>
    </DashboardLayout>
  )
}
