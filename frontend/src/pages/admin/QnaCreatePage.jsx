import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/common/Button'
import { Label } from '@/components/common/Label'
import { inputCls, textareaCls, errorInputCls } from '@/utils/ui'
import { createQna } from '../../api/qna'
import toast from 'react-hot-toast'
import { Surface } from '@/components/common/Surface'
import { Stack } from '@/components/common/Stack'
import AutoCloseField from '../../components/qna/AutoCloseField'

export default function QnaCreatePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [endAt, setEndAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [errors, setErrors] = useState({})

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
        visibility: 'PUBLIC',
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
