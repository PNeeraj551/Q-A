import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../../api/socketUrl'
import { useAuth } from '../../context/AuthContext'
import { getSessions } from '../../api/sessions'
import DashboardLayout from '../../components/DashboardLayout'
import { Input } from '@/components/ui/input'

const STATUS_META = {
  SCHEDULED:      { label: 'Upcoming', dot: 'bg-amber-400',                   bar: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  PRE_SESSION:    { label: 'Starting', dot: 'bg-amber-500 animate-pulse',   bar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800 ring-amber-300' },
  ACTIVE_SESSION: { label: 'Live',     dot: 'bg-emerald-500 animate-pulse',   bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  POST_SESSION:   { label: 'Live (Ending)', dot: 'bg-emerald-400',            bar: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
  CLOSED:         { label: 'Ended',    dot: 'bg-muted-foreground/30',         bar: 'bg-muted',       badge: 'bg-muted text-muted-foreground ring-border' },
}

const FILTERS = ['ALL', 'LIVE', 'UPCOMING', 'ENDED']
const FILTER_LABELS = { ALL: 'All', LIVE: 'Live', UPCOMING: 'Upcoming', ENDED: 'Ended' }

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

const POLL_INTERVAL = 30_000

export default function AvailableSessionsList() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [sessionSearch, setSessionSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const silentRefresh = useCallback(async () => {
    try {
      const res = await getSessions()
      setSessions(res.data.sessions)
    } catch {}
  }, [])

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getSessions()
      setSessions(res.data.sessions)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load sessions.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true)
    await silentRefresh()
    setRefreshing(false)
  }, [silentRefresh])

  useEffect(() => {
    fetchSessions()
    const poll = setInterval(silentRefresh, POLL_INTERVAL)
    return () => clearInterval(poll)
  }, [fetchSessions, silentRefresh])

  // Socket: instant update when admin creates/updates a session
  useEffect(() => {
    const token = localStorage.getItem('jwt')
    if (!token) return
    const socket = io(SOCKET_URL, { autoConnect: false, auth: { token } })
    socket.on('connect', () => {})
    socket.on('session:created', () => silentRefresh())
    socket.on('session:updated', () => silentRefresh())
    socket.on('session:state_changed', () => silentRefresh())
    socket.connect()
    return () => socket.disconnect()
  }, [silentRefresh])

  const counts = sessions.reduce((acc, s) => {
    if (s.session_status === 'ACTIVE_SESSION' || s.session_status === 'POST_SESSION') acc.LIVE = (acc.LIVE || 0) + 1
    if (s.session_status === 'SCHEDULED' || s.session_status === 'PRE_SESSION') acc.UPCOMING = (acc.UPCOMING || 0) + 1
    if (s.session_status === 'CLOSED') acc.ENDED = (acc.ENDED || 0) + 1
    return acc
  }, { LIVE: 0, UPCOMING: 0, ENDED: 0 })

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = !sessionSearch.trim() ||
      s.session_title.toLowerCase().includes(sessionSearch.trim().toLowerCase())
    
    let matchesFilter = true
    if (activeFilter === 'LIVE') matchesFilter = (s.session_status === 'ACTIVE_SESSION' || s.session_status === 'POST_SESSION')
    if (activeFilter === 'UPCOMING') matchesFilter = (s.session_status === 'SCHEDULED' || s.session_status === 'PRE_SESSION')
    if (activeFilter === 'ENDED') matchesFilter = s.session_status === 'CLOSED'
    
    return matchesSearch && matchesFilter
  }).sort((a, b) => {
    const order = { ACTIVE_SESSION: 1, POST_SESSION: 2, PRE_SESSION: 3, SCHEDULED: 4, CLOSED: 5 }
    const orderA = order[a.session_status] || 99
    const orderB = order[b.session_status] || 99
    if (orderA !== orderB) return orderA - orderB
    return new Date(b.planned_date) - new Date(a.planned_date)
  })

  const refreshAction = (
    <button
      onClick={handleManualRefresh}
      disabled={refreshing}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
    >
      <svg className={`w-3.5 h-3.5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {refreshing ? 'Refreshing...' : 'Refresh'}
    </button>
  )

  return (
    <DashboardLayout
      title="Available Sessions"
      subtitle={`Welcome back, ${user?.name?.split(' ')[0] || 'there'} 👋`}
      actions={refreshAction}
    >
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Live Sessions"
          value={counts.LIVE}
          color="bg-emerald-50"
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01" />
            </svg>
          }
        />
        <StatCard
          label="Upcoming"
          value={counts.UPCOMING}
          color="bg-amber-50"
          icon={
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
          }
        />
        <StatCard
          label="Total Available"
          value={sessions.length}
          color="bg-muted"
          icon={
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Filter + Search */}
      <div className="bg-card rounded-2xl border border-border shadow-sm mb-5 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  activeFilter === f
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <Input
              type="text"
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              placeholder="Search sessions..."
              className="pl-8 h-9"
            />
          </div>
        </div>
      </div>

      {/* Session list */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm font-medium">No sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <SessionCard key={session._id} session={session} navigate={navigate} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}

function SessionCard({ session, navigate }) {
  const meta = STATUS_META[session.session_status] || STATUS_META.CLOSED
  const isLive = session.session_status === 'ACTIVE_SESSION'
  const isScheduled = session.session_status === 'SCHEDULED'
  const date = new Date(session.planned_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const startTime = new Date(session.planned_start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex hover:shadow-md hover:border-primary/20 hover:-translate-y-px transition-all duration-200">
      <div className={`w-1 shrink-0 ${meta.bar}`} />

      <div className="flex-1 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-foreground text-sm">{session.session_title}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${meta.badge}`}>
              <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
              {meta.label.toUpperCase()}
            </span>
            {session.access_type === 'PRIVATE' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                PRIVATE
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

        <div className="shrink-0 flex items-center">
          {!session.is_assigned && session.access_type === 'PRIVATE' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border border-border px-4 py-2 rounded-xl">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Private Access
            </span>
          ) : isLive || session.session_status === 'PRE_SESSION' || session.session_status === 'POST_SESSION' ? (
            <button
              onClick={() => navigate(`/sessions/${session._id}`)}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm hover:shadow-emerald-200 active:scale-95"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {session.session_status === 'PRE_SESSION' ? 'JOIN EARLY' : 'JOIN LIVE'}
            </button>
          ) : isScheduled ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl">
              Starts at {startTime}
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
              Session Ended
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
