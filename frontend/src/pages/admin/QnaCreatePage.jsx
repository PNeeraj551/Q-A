import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/common/Button'
import { Label } from '@/components/common/Label'
import { inputCls, textareaCls, errorInputCls } from '@/utils/ui'
import { createQna } from '../../api/qna'
import { getUsers } from '../../api/users'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { UserTag } from '@/components/users/UserTag'
import { Surface } from '@/components/common/Surface'
import { Stack } from '@/components/common/Stack'
import { Text } from '@/components/common/Text'
import AutoCloseField from '../../components/qna/AutoCloseField'

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
    if (endAt && new Date(endAt) < new Date()) errs.endAt = 'Close date and time must be in the future'
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

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">Privacy</p>
                  <p className="text-xs text-slate-500 mt-0.5">Control who can view this board</p>
                </div>
                <div className="flex bg-slate-100 rounded-lg p-0.5 shrink-0">
                  {[
                    { value: 'PUBLIC', label: 'Public' },
                    { value: 'PRIVATE', label: 'Private' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      onClick={() => setVisibility(opt.value)}
                      className={`px-3 h-7 rounded-md text-sm font-medium transition-all duration-150 ${
                        visibility === opt.value
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      } disabled:opacity-50`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3.5">
                <AutoCloseField
                  value={endAt}
                  onChange={setEndAt}
                  disabled={submitting}
                  minDate={new Date().toISOString().slice(0, 10) + 'T00:00'}
                  showClear={false}
                  error={errors.endAt}
                />
              </div>
            </div>

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
