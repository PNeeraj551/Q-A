import { useEffect, useState } from 'react'
import { getPresence } from '../api/peerCoordination'

export default function ParticipantsDirectoryModal({ sessionId, isOpen, onClose, socket, currentUserId, userRole, onCoordinate }) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    getPresence(sessionId)
      .then(res => setParticipants(res.data.participants || []))
      .catch(() => setParticipants([]))
      .finally(() => setLoading(false))
  }, [isOpen, sessionId])

  useEffect(() => {
    if (!socket || !isOpen) return
    function onUpdate({ participants: list }) {
      setParticipants(list || [])
    }
    socket.on('peer:presence_update', onUpdate)
    return () => socket.off('peer:presence_update', onUpdate)
  }, [socket, isOpen])

  if (!isOpen) return null

  const onlineCount = participants.length

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Session Participants</h2>
            <p className="text-xs text-slate-500 mt-0.5">{onlineCount} online</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : participants.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">No participants online</p>
          ) : (
            participants.map(p => {
              const isSelf = p.user_id?.toString() === currentUserId?.toString()
              const isAdmin = p.role === 'admin'
              const joinTime = p.join_time ? new Date(p.join_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''

              return (
                <div key={p.user_id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {p.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {p.name}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-slate-400">(You)</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isAdmin ? 'Session host' : `Joined ${joinTime}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {isAdmin ? 'Admin' : 'Participant'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Online
                    </span>
                    {!isSelf && !isAdmin && userRole !== 'admin' && (
                      <button
                        onClick={() => { onCoordinate(p); onClose() }}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                      >
                        Collaborate
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
