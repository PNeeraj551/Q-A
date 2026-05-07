import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSessions, deleteSession, updateSession, updateSessionStatus,
  getSessionParticipants, addSessionParticipant, removeSessionParticipant,
} from '../../api/sessions'
import { searchUsers } from '../../api/users'
import { adminResetPassword, getResetRequests } from '../../api/auth'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const STATUS_META = {
  SCHEDULED:      { label: 'Scheduled',  dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 ring-amber-200',  bar: 'bg-amber-400' },
  ACTIVE_SESSION: { label: 'Live',        dot: 'bg-emerald-500 animate-pulse', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500' },
  CLOSED:         { label: 'Closed',      dot: 'bg-muted-foreground/30', badge: 'bg-muted text-muted-foreground ring-border', bar: 'bg-muted-foreground/10' },
}

const FILTERS = ['ALL', 'SCHEDULED', 'ACTIVE_SESSION', 'CLOSED']
const FILTER_LABELS = { ALL: 'All', SCHEDULED: 'Scheduled', ACTIVE_SESSION: 'Live', CLOSED: 'Closed' }

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex items-center gap-4 transition-all hover:shadow-md">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function SessionDashboard() {
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState('ALL')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [statusTarget, setStatusTarget] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')

  const [sessionSearch, setSessionSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editErrors, setEditErrors] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [editServerError, setEditServerError] = useState('')

  const [participantSession, setParticipantSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [removeLoadingId, setRemoveLoadingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addLoadingId, setAddLoadingId] = useState(null)
  const [participantError, setParticipantError] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 350)
  const searchRef = useRef(null)

  const [resetRequests, setResetRequests] = useState([])
  const [resetPanelOpen, setResetPanelOpen] = useState(false)
  const [resetLoadingId, setResetLoadingId] = useState(null)
  const [resetReveal, setResetReveal] = useState({})
  const [resetPanelError, setResetPanelError] = useState('')

  function openEdit(session) {
    const startDT = new Date(session.planned_start_time)
    const endDT   = new Date(session.planned_end_time)
    const toDate   = d => d.toISOString().slice(0, 10)
    const toTime   = d => d.toTimeString().slice(0, 5)
    setEditTarget(session)
    setEditForm({
      session_title:       session.session_title,
      session_description: session.session_description || '',
      planned_date:        toDate(startDT),
      planned_start_time:  toTime(startDT),
      planned_end_time:    toTime(endDT),
    })
    setEditErrors({})
    setEditServerError('')
  }

  function setEditField(field, value) {
    setEditForm(prev => ({ ...prev, [field]: value }))
    setEditErrors(prev => ({ ...prev, [field]: '' }))
  }

  function validateEdit() {
    const f = editForm
    const errs = {}
    if (!f.session_title?.trim()) errs.session_title = 'Title is required'
    else if (f.session_title.trim().length > 120) errs.session_title = 'Max 120 characters'
    if (f.session_description?.length > 500) errs.session_description = 'Max 500 characters'
    const canEditTime = editTarget?.session_status === 'SCHEDULED'
    if (canEditTime) {
      if (!f.planned_date) errs.planned_date = 'Date is required'
      if (!f.planned_start_time) errs.planned_start_time = 'Start time is required'
      if (!f.planned_end_time) errs.planned_end_time = 'End time is required'
      if (f.planned_date && f.planned_start_time && f.planned_end_time) {
        const s = new Date(`${f.planned_date}T${f.planned_start_time}`)
        const e = new Date(`${f.planned_date}T${f.planned_end_time}`)
        if (!isNaN(s) && !isNaN(e) && e <= s) errs.planned_end_time = 'End time must be after start time'
      }
    }
    return errs
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    const errs = validateEdit()
    if (Object.keys(errs).length) { setEditErrors(errs); return }
    setEditLoading(true)
    setEditServerError('')
    const f = editForm
    const canEditTime = editTarget?.session_status === 'SCHEDULED'
    const payload = {
      session_title: f.session_title.trim(),
      session_description: f.session_description.trim() || undefined,
    }
    if (canEditTime) {
      payload.planned_date        = new Date(f.planned_date).toISOString()
      payload.planned_start_time  = new Date(`${f.planned_date}T${f.planned_start_time}`).toISOString()
      payload.planned_end_time    = new Date(`${f.planned_date}T${f.planned_end_time}`).toISOString()
    }
    try {
      await updateSession(editTarget._id, payload)
      setEditTarget(null)
      fetchSessions()
    } catch (err) {
      setEditServerError(err.response?.data?.error || err.response?.data?.message || 'Failed to update session.')
    } finally {
      setEditLoading(false)
    }
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = activeFilter !== 'ALL' ? { status: activeFilter } : {}
      const res = await getSessions(params)
      setSessions(res.data.sessions)
    } catch {
      setError('Failed to load sessions.')
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const fetchResetRequests = useCallback(async () => {
    try {
      const res = await getResetRequests()
      setResetRequests(res.data.requests || [])
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => { fetchResetRequests() }, [fetchResetRequests])

  useEffect(() => {
    if (!participantSession) return
    if (!debouncedSearch.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    searchUsers(debouncedSearch)
      .then(res => {
        const existing = participants.map(p => p._id)
        setSearchResults((res.data.users || []).filter(u => !existing.includes(u._id) && u.role === 'participant'))
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false))
  }, [debouncedSearch, participantSession, participants])

  async function openParticipants(session) {
    setParticipantSession(session)
    setParticipants([])
    setSearchQuery('')
    setSearchResults([])
    setParticipantError('')
    setParticipantsLoading(true)
    try {
      const res = await getSessionParticipants(session._id)
      setParticipants(res.data.participants || [])
    } catch {
      setParticipantError('Failed to load participants.')
    } finally {
      setParticipantsLoading(false)
    }
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  function closeParticipants() {
    setParticipantSession(null)
    setParticipants([])
    setSearchQuery('')
    setSearchResults([])
    setParticipantError('')
  }

  async function handleAddParticipant(user) {
    setAddLoadingId(user._id)
    setParticipantError('')
    try {
      await addSessionParticipant(participantSession._id, user._id)
      setParticipants(prev => [...prev, user])
      setSearchResults(prev => prev.filter(u => u._id !== user._id))
      setSearchQuery('')
    } catch (err) {
      setParticipantError(err.response?.data?.error || err.response?.data?.message || 'Failed to add participant.')
    } finally {
      setAddLoadingId(null)
    }
  }

  async function handleRemoveParticipant(userId) {
    setRemoveLoadingId(userId)
    setParticipantError('')
    try {
      await removeSessionParticipant(participantSession._id, userId)
      setParticipants(prev => prev.filter(p => p._id !== userId))
    } catch (err) {
      setParticipantError(err.response?.data?.error || err.response?.data?.message || 'Failed to remove participant.')
    } finally {
      setRemoveLoadingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteSession(deleteTarget._id)
      setDeleteTarget(null)
      fetchSessions()
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.response?.data?.message || 'Failed to delete session.')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function confirmStatusChange() {
    if (!statusTarget) return
    setStatusLoading(true)
    setStatusError('')
    try {
      await updateSessionStatus(statusTarget.session._id, statusTarget.newStatus)
      setStatusTarget(null)
      fetchSessions()
    } catch (err) {
      setStatusError(err.response?.data?.error || err.response?.data?.message || 'Failed to update status.')
    } finally {
      setStatusLoading(false)
    }
  }

  function getNextStatuses(status) {
    return { SCHEDULED: ['ACTIVE_SESSION', 'CLOSED'], ACTIVE_SESSION: ['CLOSED'], CLOSED: [] }[status] || []
  }

  async function handleAdminReset(request) {
    setResetLoadingId(request._id)
    setResetPanelError('')
    try {
      const res = await adminResetPassword(request.participant_id)
      const tempPwd = res.data.temporaryPassword
      setResetReveal(prev => ({ ...prev, [request._id]: tempPwd }))
      await fetchResetRequests()
    } catch (err) {
      setResetPanelError(err.response?.data?.error || 'Failed to reset password.')
    } finally {
      setResetLoadingId(null)
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const counts = sessions.reduce((acc, s) => {
    acc[s.session_status] = (acc[s.session_status] || 0) + 1
    return acc
  }, {})

  const STATUS_SORT_ORDER = {
    ACTIVE_SESSION: 1,
    PRE_SESSION: 2,
    SCHEDULED: 3,
    POST_SESSION: 4,
    CLOSED: 5
  }

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = !sessionSearch.trim() ||
      s.session_title.toLowerCase().includes(sessionSearch.trim().toLowerCase())
    const matchesDate = !dateFilter ||
      new Date(s.planned_date).toISOString().slice(0, 10) === dateFilter
    return matchesSearch && matchesDate
  }).sort((a, b) => {
    const orderA = STATUS_SORT_ORDER[a.session_status] || 99
    const orderB = STATUS_SORT_ORDER[b.session_status] || 99
    if (orderA !== orderB) return orderA - orderB
    return new Date(b.planned_date) - new Date(a.planned_date)
  })

  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE)
  const pagedSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const layoutActions = (
    <Button
      id="new-session-btn"
      onClick={() => navigate('/admin/sessions/create')}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      New Session
    </Button>
  )

  return (
    <DashboardLayout
      title="Sessions"
      subtitle={`${sessions.length} total · ${counts.ACTIVE_SESSION || 0} live`}
      actions={layoutActions}
      resetBadge={resetRequests.length}
      onResetClick={() => { setResetPanelOpen(true); setResetPanelError('') }}
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Sessions"
          value={sessions.length}
          color="bg-slate-100"
          icon={
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Live Now"
          value={counts.ACTIVE_SESSION || 0}
          color="bg-emerald-50"
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01" />
            </svg>
          }
        />
        <StatCard
          label="Scheduled"
          value={counts.SCHEDULED || 0}
          color="bg-amber-50"
          icon={
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
          }
        />
        <StatCard
          label="Closed"
          value={counts.CLOSED || 0}
          color="bg-muted"
          icon={
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          }
        />
      </div>

      {/* Filter + Search */}
      <div className="bg-card rounded-2xl border border-border shadow-sm mb-5 overflow-hidden">
        {/* Filter tabs */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setPage(1) }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  activeFilter === f
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {FILTER_LABELS[f]}
                {f !== 'ALL' && counts[f] ? (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/10 text-muted-foreground'}`}>
                    {counts[f]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Search + date */}
        <div className="px-4 py-3 flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <Input
              id="session-search"
              type="text"
              value={sessionSearch}
              onChange={e => { setSessionSearch(e.target.value); setPage(1) }}
              placeholder="Search sessions..."
              className="pl-8 h-9"
            />
            {sessionSearch && (
              <button
                onClick={() => setSessionSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); setPage(1) }}
              className="pl-8 pr-2 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 focus:bg-white transition w-36"
            />
          </div>
          {(sessionSearch || dateFilter) && (
            <button
              onClick={() => { setSessionSearch(''); setDateFilter('') }}
              className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Session list */}
      {loading && (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </div>
      )}

      {!loading && !error && filteredSessions.length === 0 && (
        <div className="text-center py-24">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-700 text-sm font-semibold">No sessions found</p>
          <p className="text-slate-400 text-xs mt-1 mb-5">Create your first Q&A session to get started</p>
          <Button
            id="create-first-session-btn"
            onClick={() => navigate('/admin/sessions/create')}
          >
            Create Session
          </Button>
        </div>
      )}

      {!loading && !error && filteredSessions.length > 0 && (
        <div className="space-y-3">
          {pagedSessions.map((session) => {
            const meta = STATUS_META[session.session_status] || STATUS_META.CLOSED
            const nextStatuses = getNextStatuses(session.session_status)
            const isPrivate = session.access_type === 'PRIVATE'
            const startTime = new Date(session.planned_start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            const date = new Date(session.planned_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

            return (
              <div
                key={session._id}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex hover:shadow-md hover:border-primary/20 hover:-translate-y-px transition-all duration-200"
              >
                <div className={`w-1 shrink-0 ${meta.bar}`} />

                <div className="flex-1 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-foreground text-sm">{session.session_title}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${meta.badge}`}>
                        <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                        {meta.label.toUpperCase()}
                      </span>
                      {isPrivate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 uppercase">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <rect x="3" y="11" width="18" height="11" rx="2" /><path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                          PRIVATE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 ring-1 ring-sky-200 uppercase">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                          </svg>
                          PUBLIC
                        </span>
                      )}
                    </div>

                    {session.session_description && (
                      <p className="text-xs text-muted-foreground truncate mb-2">{session.session_description}</p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                        </svg>
                        <span>{startTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {isPrivate && session.session_status !== 'CLOSED' && (
                      <button
                        onClick={() => openParticipants(session)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all uppercase active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Invite
                      </button>
                    )}

                    {nextStatuses.map(ns => (
                      <button
                        key={ns}
                        onClick={() => { setStatusTarget({ session, newStatus: ns }); setStatusError('') }}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all uppercase active:scale-95 ${
                          ns === 'ACTIVE_SESSION'
                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            : 'border-border text-muted-foreground bg-card hover:bg-muted'
                        }`}
                      >
                        {ns === 'ACTIVE_SESSION' ? 'Go Live' : 'Close'}
                      </button>
                    ))}

                    {session.session_status === 'ACTIVE_SESSION' && (
                      <button
                        onClick={() => navigate(`/admin/sessions/${session._id}/feed`)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm active:scale-95 uppercase"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Open Feed
                      </button>
                    )}


                    {session.session_status !== 'CLOSED' && (
                      <button
                        onClick={() => openEdit(session)}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit session"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}

                    {session.session_status === 'SCHEDULED' && (
                      <button
                        onClick={() => { setDeleteTarget(session); setDeleteError('') }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete session"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSessions.length)} of {filteredSessions.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                  n === page
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}


      {/* Participant Management Modal */}
      {participantSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Manage Participants</h2>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{participantSession.session_title}</p>
              </div>
              <button
                onClick={closeParticipants}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {participantError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">
                  {participantError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Add participants</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setParticipantError('') }}
                    placeholder="Search by name or email..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50 focus:bg-white transition"
                  />
                  {searchLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {searchResults.map(user => (
                      <div key={user._id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {user.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddParticipant(user)}
                          disabled={addLoadingId === user._id}
                          className="shrink-0 ml-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {addLoadingId === user._id ? '...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && !searchLoading && searchResults.length === 0 && (
                  <p className="mt-2 text-xs text-slate-400 text-center py-2">No participants found</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">Invited ({participants.length})</label>
                </div>

                {participantsLoading && (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {!participantsLoading && participants.length === 0 && (
                  <div className="text-center py-6 text-slate-400">
                    <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-xs">No participants invited yet</p>
                  </div>
                )}

                {!participantsLoading && participants.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {participants.map(p => (
                      <div key={p._id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {p.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                            <p className="text-xs text-slate-400 truncate">{p.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveParticipant(p._id)}
                          disabled={removeLoadingId === p._id}
                          className="shrink-0 ml-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {removeLoadingId === p._id ? '...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={closeParticipants}
                className="w-full text-sm font-medium text-slate-700 hover:text-slate-900 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Session</h2>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{editTarget.session_title}</p>
              </div>
              <button
                onClick={() => setEditTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} noValidate>
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {editServerError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">
                    {editServerError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Session Title *</label>
                  <input
                    type="text"
                    value={editForm.session_title || ''}
                    onChange={e => setEditField('session_title', e.target.value)}
                    maxLength={120}
                    disabled={editLoading}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${editErrors.session_title ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {editErrors.session_title && <p className="mt-1 text-xs text-red-500">{editErrors.session_title}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
                  <textarea
                    value={editForm.session_description || ''}
                    onChange={e => setEditField('session_description', e.target.value)}
                    maxLength={500}
                    rows={3}
                    disabled={editLoading}
                    placeholder="Optional"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none ${editErrors.session_description ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  <p className="text-right text-xs text-slate-400 mt-0.5">{(editForm.session_description || '').length}/500</p>
                </div>

                {editTarget.session_status === 'SCHEDULED' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date *</label>
                      <input
                        type="date"
                        value={editForm.planned_date || ''}
                        onChange={e => setEditField('planned_date', e.target.value)}
                        disabled={editLoading}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${editErrors.planned_date ? 'border-red-400' : 'border-slate-200'}`}
                      />
                      {editErrors.planned_date && <p className="mt-1 text-xs text-red-500">{editErrors.planned_date}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Start Time *</label>
                        <input
                          type="time"
                          value={editForm.planned_start_time || ''}
                          onChange={e => setEditField('planned_start_time', e.target.value)}
                          disabled={editLoading}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${editErrors.planned_start_time ? 'border-red-400' : 'border-slate-200'}`}
                        />
                        {editErrors.planned_start_time && <p className="mt-1 text-xs text-red-500">{editErrors.planned_start_time}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">End Time *</label>
                        <input
                          type="time"
                          value={editForm.planned_end_time || ''}
                          onChange={e => setEditField('planned_end_time', e.target.value)}
                          disabled={editLoading}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${editErrors.planned_end_time ? 'border-red-400' : 'border-slate-200'}`}
                        />
                        {editErrors.planned_end_time && <p className="mt-1 text-xs text-red-500">{editErrors.planned_end_time}</p>}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-amber-700">Time editing locked</p>
                      <p className="text-xs text-amber-600 mt-0.5">Date and time cannot be changed once a session is live.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditTarget(null)}
                  disabled={editLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1"
                >
                  {editLoading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Delete Session</h2>
            <p className="text-sm text-slate-500 mb-5">
              Are you sure you want to delete <span className="font-semibold text-slate-700">"{deleteTarget.session_title}"</span>? This cannot be undone.
            </p>
            {deleteError && <p className="text-xs text-red-500 mb-3">{deleteError}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                disabled={deleteLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1"
              >
                {deleteLoading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {statusTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              statusTarget.newStatus === 'ACTIVE_SESSION' ? 'bg-emerald-50' : 'bg-slate-100'
            }`}>
              {statusTarget.newStatus === 'ACTIVE_SESSION' ? (
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              {statusTarget.newStatus === 'ACTIVE_SESSION' ? 'Go Live?' : 'Close Session?'}
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              {statusTarget.newStatus === 'ACTIVE_SESSION'
                ? `"${statusTarget.session.session_title}" will go live and participants can join.`
                : `"${statusTarget.session.session_title}" will be closed. Participants will no longer be able to join.`}
            </p>
            {statusError && <p className="text-xs text-red-500 mb-3">{statusError}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setStatusTarget(null); setStatusError('') }}
                disabled={statusLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmStatusChange}
                disabled={statusLoading}
                className={`flex-1 ${
                  statusTarget.newStatus === 'ACTIVE_SESSION'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {statusLoading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {statusLoading ? 'Updating...' : statusTarget.newStatus === 'ACTIVE_SESSION' ? 'Go Live' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Requests Modal */}
      {resetPanelOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Password Reset Requests</h2>
                <p className="text-xs text-slate-400 mt-0.5">{resetRequests.length} pending</p>
              </div>
              <button
                onClick={() => { setResetPanelOpen(false); setResetPanelError(''); setResetReveal({}) }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {resetPanelError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600">
                  {resetPanelError}
                </div>
              )}

              {resetRequests.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <p className="text-xs">No pending reset requests</p>
                </div>
              )}

              {resetRequests.map(req => (
                <div key={req._id} className="border border-slate-200 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{req.participant_name}</p>
                      <p className="text-xs text-slate-400 truncate">{req.participant_email}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(req.requested_at).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!resetReveal[req._id] && (
                      <button
                        onClick={() => handleAdminReset(req)}
                        disabled={resetLoadingId === req._id}
                        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        {resetLoadingId === req._id && (
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        {resetLoadingId === req._id ? 'Resetting...' : 'Reset Password'}
                      </button>
                    )}
                  </div>

                  {resetReveal[req._id] && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 mb-0.5">Temporary Password</p>
                        <p className="text-sm font-mono text-emerald-900">{resetReveal[req._id]}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(resetReveal[req._id])}
                        className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
              <Button
                variant="ghost"
                onClick={() => { setResetPanelOpen(false); setResetPanelError(''); setResetReveal({}) }}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
