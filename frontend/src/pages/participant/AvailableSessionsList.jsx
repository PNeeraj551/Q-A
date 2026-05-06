import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getSessions } from '../../api/sessions'
import Footer from '../../components/Footer'
import ProfileEditPanel from '../../components/ProfileEditPanel'

const STATUS_META = {
  SCHEDULED:      { label: 'Upcoming', dot: 'bg-amber-400',                   bar: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ACTIVE_SESSION: { label: 'Live',     dot: 'bg-emerald-500 animate-pulse',   bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CLOSED:         { label: 'Ended',    dot: 'bg-slate-300',                   bar: 'bg-slate-200',   badge: 'bg-slate-100 text-slate-500 ring-slate-200' },
}

export default function AvailableSessionsList() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await getSessions()
        setSessions(res.data.sessions)
      } catch {
        setError('Failed to load sessions.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const liveSessions = sessions.filter(s => s.session_status === 'ACTIVE_SESSION')
  const upcomingSessions = sessions.filter(s => s.session_status === 'SCHEDULED')

  const initial = user?.name?.[0]?.toUpperCase() || '?'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-900">Q&A Sessions</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setProfileOpen(true)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm select-none hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              title="Edit profile"
            >
              {initial}
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Welcome bar */}
      <div className="bg-indigo-600 px-6 py-4 shrink-0">
        <p className="text-white font-semibold text-sm">
          Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
        </p>
        <p className="text-indigo-200 text-xs mt-0.5">
          {liveSessions.length > 0
            ? `${liveSessions.length} live session${liveSessions.length > 1 ? 's' : ''} right now`
            : 'No live sessions right now — check back soon'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5 space-y-5">

        {loading && (
          <div className="flex justify-center pt-16">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center pt-12 pb-6">
            <p className="text-slate-600 text-sm font-medium">No sessions available yet</p>
            <p className="text-slate-400 text-xs mt-1">Sessions will appear here once scheduled by the host.</p>
          </div>
        )}

        {!loading && !error && liveSessions.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Now</p>
            </div>
            <div className="space-y-2">
              {liveSessions.map(s => <SessionCard key={s._id} session={s} navigate={navigate} />)}
            </div>
          </section>
        )}

        {!loading && !error && upcomingSessions.length > 0 && (
          <section>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Upcoming</p>
            <div className="space-y-2">
              {upcomingSessions.map(s => <SessionCard key={s._id} session={s} navigate={navigate} />)}
            </div>
          </section>
        )}

        {!loading && (
          <p className="text-xs text-slate-400 text-center pt-2">
            Need help? Contact{' '}
            <a href="mailto:support@athivatech.com" className="text-indigo-600 hover:underline">
              support@athivatech.com
            </a>
          </p>
        )}
      </div>

      <Footer />
      {profileOpen && <ProfileEditPanel onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

function SessionCard({ session, navigate }) {
  const meta = STATUS_META[session.session_status] || STATUS_META.CLOSED
  const isLive = session.session_status === 'ACTIVE_SESSION'
  const isScheduled = session.session_status === 'SCHEDULED'
  const date = new Date(session.planned_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = new Date(session.planned_start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden flex transition-shadow ${
      isLive ? 'border-emerald-200 hover:shadow-md' : 'border-slate-200 hover:shadow-sm'
    }`}>
      <div className={`w-1 shrink-0 ${meta.bar}`} />

      <div className="flex-1 px-4 py-3.5 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{session.session_title}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
            <span>{date}</span>
            <span className="mx-0.5">·</span>
            <span>{startTime}</span>
          </div>
        </div>

        <div className="shrink-0">
          {isLive ? (
            <button
              onClick={() => navigate(`/sessions/${session._id}`)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Join Now
            </button>
          ) : isScheduled ? (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              {startTime}
            </span>
          ) : (
            <span className="text-xs text-slate-400">Ended</span>
          )}
        </div>
      </div>
    </div>
  )
}
