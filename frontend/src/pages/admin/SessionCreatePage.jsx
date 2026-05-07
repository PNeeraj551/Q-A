import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession } from '../../api/sessions'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

function FormField({ label, required, error, htmlFor, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function SectionHeading({ number, title }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
      <span className="w-6 h-6 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
        {number}
      </span>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    </div>
  )
}

export default function SessionCreatePage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    session_title: '',
    session_description: '',
    planned_date: '',
    planned_start_time: '',
    planned_end_time: '',
    access_type: 'PUBLIC',
    pre_session_enabled: false,
    pre_session_minutes: '',
  })

  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function validate() {
    const errs = {}
    if (!form.session_title.trim()) {
      errs.session_title = 'Session title is required'
    } else if (form.session_title.trim().length > 120) {
      errs.session_title = 'Session title cannot exceed 120 characters'
    }
    if (form.session_description && form.session_description.length > 500) {
      errs.session_description = 'Description cannot exceed 500 characters'
    }
    if (!form.planned_date) errs.planned_date = 'Date is required'
    if (!form.planned_start_time) errs.planned_start_time = 'Start time is required'
    if (!form.planned_end_time) errs.planned_end_time = 'End time is required'
    if (form.planned_start_time && form.planned_end_time && form.planned_date) {
      const start = new Date(`${form.planned_date}T${form.planned_start_time}`)
      const end = new Date(`${form.planned_date}T${form.planned_end_time}`)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
        errs.planned_end_time = 'End time must be after start time'
      }
    }
    if (!['PUBLIC', 'PRIVATE'].includes(form.access_type)) {
      errs.access_type = 'Access type is required'
    }
    if (form.pre_session_enabled) {
      const mins = Number(form.pre_session_minutes)
      if (!form.pre_session_minutes) {
        errs.pre_session_minutes = 'Pre-session minutes is required when pre-session is enabled'
      } else if (!Number.isInteger(mins) || mins < 5 || mins > 120) {
        errs.pre_session_minutes = 'Must be an integer between 5 and 120'
      }
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const payload = {
        session_title: form.session_title.trim(),
        planned_date: new Date(form.planned_date).toISOString(),
        planned_start_time: new Date(`${form.planned_date}T${form.planned_start_time}`).toISOString(),
        planned_end_time: new Date(`${form.planned_date}T${form.planned_end_time}`).toISOString(),
        access_type: form.access_type,
        pre_session_enabled: form.pre_session_enabled,
      }
      if (form.session_description.trim()) {
        payload.session_description = form.session_description.trim()
      }
      if (form.pre_session_enabled) {
        payload.pre_session_minutes = Number(form.pre_session_minutes)
      }
      if (form.access_type === 'PRIVATE') {
        payload.assigned_participants = []
      }
      await createSession(payload)
      navigate('/admin/sessions')
    } catch (err) {
      setServerError(err.response?.data?.message || 'Failed to create session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout
      title="New Session"
      subtitle="Schedule a Q&A session for your team"
      onBack={() => navigate('/admin/sessions')}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="max-w-2xl mx-auto pb-24">

          {/* Single unified card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Section 1: Session Details */}
            <div className="px-6 py-6 space-y-5">
              <SectionHeading number="01" title="Session Details" />

              <FormField label="Session Title" required htmlFor="session-title" error={errors.session_title}>
                <Input
                  id="session-title"
                  type="text"
                  value={form.session_title}
                  onChange={(e) => set('session_title', e.target.value)}
                  maxLength={120}
                  disabled={loading}
                  placeholder="e.g. Company All-Hands Q3"
                  aria-invalid={!!errors.session_title}
                />
              </FormField>

              <FormField label="Description" htmlFor="session-description" error={errors.session_description}>
                <Textarea
                  id="session-description"
                  value={form.session_description}
                  onChange={(e) => set('session_description', e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={loading}
                  placeholder="Optional — give participants context about this session"
                  aria-invalid={!!errors.session_description}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{form.session_description.length}/500</p>
              </FormField>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 2: Schedule */}
            <div className="px-6 py-6 space-y-5">
              <SectionHeading number="02" title="Schedule" />

              <FormField label="Date" required htmlFor="planned-date" error={errors.planned_date}>
                <Input
                  id="planned-date"
                  type="date"
                  value={form.planned_date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set('planned_date', e.target.value)}
                  disabled={loading}
                  aria-invalid={!!errors.planned_date}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Time" required htmlFor="start-time" error={errors.planned_start_time}>
                  <Input
                    id="start-time"
                    type="time"
                    value={form.planned_start_time}
                    onChange={(e) => set('planned_start_time', e.target.value)}
                    disabled={loading}
                    aria-invalid={!!errors.planned_start_time}
                  />
                </FormField>

                <FormField label="End Time" required htmlFor="end-time" error={errors.planned_end_time}>
                  <Input
                    id="end-time"
                    type="time"
                    value={form.planned_end_time}
                    onChange={(e) => set('planned_end_time', e.target.value)}
                    disabled={loading}
                    aria-invalid={!!errors.planned_end_time}
                  />
                </FormField>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 3: Settings */}
            <div className="px-6 py-6 space-y-5">
              <SectionHeading number="03" title="Settings" />

              {/* Access Type */}
              <div>
                <Label className="mb-2 block">
                  Access Type<span className="text-destructive ml-0.5">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => set('access_type', 'PUBLIC')}
                    disabled={loading}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      form.access_type === 'PUBLIC'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      form.access_type === 'PUBLIC' ? 'bg-primary/10' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-4 h-4 ${form.access_type === 'PUBLIC' ? 'text-primary' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${form.access_type === 'PUBLIC' ? 'text-primary' : 'text-slate-700'}`}>Public</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">Anyone with the link can join</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => set('access_type', 'PRIVATE')}
                    disabled={loading}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      form.access_type === 'PRIVATE'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      form.access_type === 'PRIVATE' ? 'bg-primary/10' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-4 h-4 ${form.access_type === 'PRIVATE' ? 'text-primary' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${form.access_type === 'PRIVATE' ? 'text-primary' : 'text-slate-700'}`}>Private</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">Invite-only participants</p>
                    </div>
                  </button>
                </div>
                {errors.access_type && <p className="mt-1.5 text-xs text-destructive">{errors.access_type}</p>}
              </div>

              {/* Pre-session toggle */}
              <div className="flex items-center justify-between py-3 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Enable Pre-Session Window</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow participants to join before the session starts</p>
                </div>
                <Switch
                  id="pre-session-toggle"
                  checked={form.pre_session_enabled}
                  onCheckedChange={(checked) => set('pre_session_enabled', checked)}
                  disabled={loading}
                />
              </div>

              {form.pre_session_enabled && (
                <FormField label="Pre-Session Duration (5–120 minutes)" required htmlFor="pre-session-minutes" error={errors.pre_session_minutes}>
                  <Input
                    id="pre-session-minutes"
                    type="number"
                    min={5}
                    max={120}
                    value={form.pre_session_minutes}
                    onChange={(e) => set('pre_session_minutes', e.target.value)}
                    disabled={loading}
                    placeholder="e.g. 15"
                    aria-invalid={!!errors.pre_session_minutes}
                  />
                </FormField>
              )}
            </div>

            {serverError && (
              <div className="mx-6 mb-4 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
                </svg>
                {serverError}
              </div>
            )}
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-slate-200 px-8 py-4 z-10">
          <div className="max-w-2xl mx-auto flex gap-3 justify-end">
            <Button
              id="cancel-session"
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/sessions')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              id="create-session-submit"
              type="submit"
              disabled={loading}
            >
              {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
