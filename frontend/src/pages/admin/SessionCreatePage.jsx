import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession } from '../../api/sessions'
import DashboardLayout from '../../components/DashboardLayout'

function FormField({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function SectionHeading({ number, title }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
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
            <div className="px-6 py-6 space-y-4">
              <SectionHeading number="01" title="Session Details" />

              <FormField label="Session Title" required error={errors.session_title}>
                <input
                  type="text"
                  value={form.session_title}
                  onChange={(e) => set('session_title', e.target.value)}
                  maxLength={120}
                  disabled={loading}
                  placeholder="e.g. Company All-Hands Q3"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                    errors.session_title ? 'border-red-400 bg-red-50' : 'border-slate-300'
                  }`}
                />
              </FormField>

              <FormField label="Description" error={errors.session_description}>
                <textarea
                  value={form.session_description}
                  onChange={(e) => set('session_description', e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={loading}
                  placeholder="Optional — give participants context about this session"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none ${
                    errors.session_description ? 'border-red-400 bg-red-50' : 'border-slate-300'
                  }`}
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{form.session_description.length}/500</p>
              </FormField>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 2: Schedule */}
            <div className="px-6 py-6 space-y-4">
              <SectionHeading number="02" title="Schedule" />

              <FormField label="Date" required error={errors.planned_date}>
                <input
                  type="date"
                  value={form.planned_date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set('planned_date', e.target.value)}
                  disabled={loading}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                    errors.planned_date ? 'border-red-400 bg-red-50' : 'border-slate-300'
                  }`}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Time" required error={errors.planned_start_time}>
                  <input
                    type="time"
                    value={form.planned_start_time}
                    onChange={(e) => set('planned_start_time', e.target.value)}
                    disabled={loading}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                      errors.planned_start_time ? 'border-red-400 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                </FormField>

                <FormField label="End Time" required error={errors.planned_end_time}>
                  <input
                    type="time"
                    value={form.planned_end_time}
                    onChange={(e) => set('planned_end_time', e.target.value)}
                    disabled={loading}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                      errors.planned_end_time ? 'border-red-400 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                </FormField>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 3: Settings */}
            <div className="px-6 py-6 space-y-4">
              <SectionHeading number="03" title="Settings" />

              {/* Access Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Access Type<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => set('access_type', 'PUBLIC')}
                    disabled={loading}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      form.access_type === 'PUBLIC'
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      form.access_type === 'PUBLIC' ? 'bg-indigo-100' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-4 h-4 ${form.access_type === 'PUBLIC' ? 'text-indigo-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${form.access_type === 'PUBLIC' ? 'text-indigo-700' : 'text-slate-700'}`}>Public</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">Anyone with the link can join</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => set('access_type', 'PRIVATE')}
                    disabled={loading}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      form.access_type === 'PRIVATE'
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      form.access_type === 'PRIVATE' ? 'bg-indigo-100' : 'bg-slate-100'
                    }`}>
                      <svg className={`w-4 h-4 ${form.access_type === 'PRIVATE' ? 'text-indigo-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${form.access_type === 'PRIVATE' ? 'text-indigo-700' : 'text-slate-700'}`}>Private</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">Invite-only participants</p>
                    </div>
                  </button>
                </div>
                {errors.access_type && <p className="mt-1.5 text-xs text-red-500">{errors.access_type}</p>}
              </div>

              {/* Pre-session toggle */}
              <div className="flex items-center justify-between py-3 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Enable Pre-Session Window</p>
                  <p className="text-xs text-slate-400 mt-0.5">Allow participants to join before the session starts</p>
                </div>
                <button
                  type="button"
                  onClick={() => set('pre_session_enabled', !form.pre_session_enabled)}
                  disabled={loading}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shrink-0 ${
                    form.pre_session_enabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.pre_session_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {form.pre_session_enabled && (
                <FormField label="Pre-Session Duration (5–120 minutes)" required error={errors.pre_session_minutes}>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={form.pre_session_minutes}
                    onChange={(e) => set('pre_session_minutes', e.target.value)}
                    disabled={loading}
                    placeholder="e.g. 15"
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                      errors.pre_session_minutes ? 'border-red-400 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                </FormField>
              )}
            </div>

            {serverError && (
              <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
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
            <button
              type="button"
              onClick={() => navigate('/admin/sessions')}
              disabled={loading}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
