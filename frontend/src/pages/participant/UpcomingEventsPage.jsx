import { useEffect, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../../api/socketUrl'
import { getSessions } from '../../api/sessions'
import DashboardLayout from '../../components/DashboardLayout'
import { Input } from '@/components/ui/input'

const POLL_INTERVAL = 30_000

export default function UpcomingEventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const toScheduled = (sessions) => {
    const scheduled = (sessions || []).filter(s => s.session_status === 'SCHEDULED' || s.session_status === 'PRE_SESSION')
    scheduled.sort((a, b) => new Date(a.planned_start_time) - new Date(b.planned_start_time))
    return scheduled
  }

  const silentRefresh = useCallback(async () => {
    try {
      const res = await getSessions()
      setEvents(toScheduled(res.data.sessions))
    } catch {}
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getSessions()
      setEvents(toScheduled(res.data.sessions))
    } catch {
      setError('Failed to load events.')
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
    fetchEvents()
    const poll = setInterval(silentRefresh, POLL_INTERVAL)
    return () => clearInterval(poll)
  }, [fetchEvents, silentRefresh])

  useEffect(() => {
    const token = localStorage.getItem('jwt')
    if (!token) return
    const socket = io(SOCKET_URL, { autoConnect: false, auth: { token } })
    socket.on('session:created', () => silentRefresh())
    socket.on('session:updated', () => silentRefresh())
    socket.on('session:state_changed', () => silentRefresh())
    socket.connect()
    return () => socket.disconnect()
  }, [silentRefresh])

  const filtered = events.filter(e =>
    !search.trim() || e.session_title.toLowerCase().includes(search.trim().toLowerCase())
  )

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
      title="Upcoming Events"
      subtitle={`${events.length} scheduled session${events.length !== 1 ? 's' : ''}`}
      actions={refreshAction}
    >
      {/* Search */}
      <div className="bg-card rounded-2xl border border-border shadow-sm mb-5 px-4 py-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-2xl border border-dashed border-border">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm font-medium">No upcoming events</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Check back later for scheduled sessions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => {
            const date = new Date(event.planned_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            const time = new Date(event.planned_start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            const isToday = new Date(event.planned_date).toDateString() === new Date().toDateString()

            return (
              <div key={event._id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex hover:shadow-md hover:border-primary/20 hover:-translate-y-px transition-all duration-200">
                <div className="w-1 shrink-0 bg-amber-400" />

                <div className="flex-1 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Date badge */}
                  <div className="shrink-0 w-14 text-center">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                      {new Date(event.planned_date).toLocaleDateString(undefined, { month: 'short' })}
                    </p>
                    <p className="text-2xl font-bold text-foreground leading-none">
                      {new Date(event.planned_date).getDate()}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground/60 mt-1 uppercase">
                      {new Date(event.planned_date).toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                  </div>

                  <div className="w-px h-10 bg-border shrink-0 hidden sm:block" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-foreground text-sm">{event.session_title}</span>
                      {isToday && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200 uppercase">
                          Today
                        </span>
                      )}
                      {event.access_type === 'PRIVATE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 uppercase">
                          Private
                        </span>
                      )}
                    </div>
                    {event.session_description && (
                      <p className="text-xs text-muted-foreground truncate mb-2">{event.session_description}</p>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                      </svg>
                      <span>Starts at {time}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {!event.is_assigned && event.access_type === 'PRIVATE' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border border-border px-4 py-2 rounded-xl">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="11" width="18" height="11" rx="2" /><path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        Private
                      </span>
                    ) : event.session_status === 'PRE_SESSION' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Starting Soon
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl uppercase">
                        <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
