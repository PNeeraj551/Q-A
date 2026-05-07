import { useEffect, useRef, useState, useCallback } from 'react'
import { getMyGroups, getMessages, sendMessage, leaveGroup, submitQuestion } from '../api/collaboration'
import CreateGroupModal from './CreateGroupModal'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function CollaborationPanel({
  sessionId, socket, currentUserId, sessionStatus, presenceParticipants, onClose,
}) {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSubmitQ, setShowSubmitQ] = useState(false)
  const [submitQText, setSubmitQText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [questionSubmitted, setQuestionSubmitted] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const bottomRef = useRef(null)

  const canSend = ['PRE_SESSION', 'ACTIVE_SESSION'].includes(sessionStatus)
  const canSubmitQ = sessionStatus === 'ACTIVE_SESSION'

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyGroups(sessionId)
      setGroups(res.data.groups || [])
      setError('')
    } catch {
      setError('Failed to load groups.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Initial load + listen for new groups created for self
  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  useEffect(() => {
    if (!socket) return
    socket.on('collab:group_created', fetchGroups)
    return () => socket.off('collab:group_created', fetchGroups)
  }, [socket, fetchGroups])

  // Group-level socket subscriptions
  useEffect(() => {
    if (!socket || !selectedGroup) return
    const groupId = selectedGroup._id

    socket.emit('collab:join', { group_id: groupId })

    function onMessage(msg) {
      setMessages(prev => [...prev, msg])
    }
    function onMemberLeft({ sender_name }) {
      // Detect if current user left (e.g. from another tab)
      const myName = presenceParticipants?.find(
        p => p.user_id?.toString() === currentUserId?.toString()
      )?.name
      if (myName && sender_name === myName) {
        setSelectedGroup(null)
        fetchGroups()
      } else {
        // Update the local group participant list
        setSelectedGroup(prev =>
          prev
            ? { ...prev, participants: prev.participants.filter(p => p.name !== sender_name) }
            : prev
        )
      }
    }
    function onQuestionSubmitted() {
      setQuestionSubmitted(true)
    }

    socket.on('collab:message', onMessage)
    socket.on('collab:member_left', onMemberLeft)
    socket.on('collab:question_submitted', onQuestionSubmitted)

    return () => {
      socket.emit('collab:leave', { group_id: groupId })
      socket.off('collab:message', onMessage)
      socket.off('collab:member_left', onMemberLeft)
      socket.off('collab:question_submitted', onQuestionSubmitted)
    }
  }, [socket, selectedGroup?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function openGroup(group) {
    setSelectedGroup(group)
    setMessages([])
    setQuestionSubmitted(false)
    setShowSubmitQ(false)
    setSubmitQText('')
    try {
      const res = await getMessages(group._id)
      setMessages(res.data.messages || [])
    } catch {}
  }

  function backToList() {
    setSelectedGroup(null)
    setMessages([])
    setShowSubmitQ(false)
    setSubmitQText('')
    setQuestionSubmitted(false)
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = msgText.trim()
    if (!text || !canSend || sendingMsg) return
    setSendingMsg(true)
    try {
      await sendMessage(selectedGroup._id, text)
      setMsgText('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message.')
    } finally {
      setSendingMsg(false)
    }
  }

  async function handleLeave() {
    if (leaving) return
    setLeaving(true)
    try {
      await leaveGroup(selectedGroup._id)
      backToList()
      fetchGroups()
    } catch {
      setError('Failed to leave group.')
    } finally {
      setLeaving(false)
    }
  }

  async function handleSubmitQuestion(e) {
    e.preventDefault()
    const text = submitQText.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      await submitQuestion(selectedGroup._id, text)
      setQuestionSubmitted(true)
      setShowSubmitQ(false)
      setSubmitQText('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit question.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md h-[80vh] flex flex-col">
        {/* ── LIST VIEW ── */}
        {!selectedGroup && (
          <>
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Private Collaboration</h2>
                <p className="text-xs text-slate-400 mt-0.5">Groups are private and session-scoped</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 shrink-0">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={!canSend}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Group
              </button>
              {!canSend && (
                <p className="text-xs text-slate-400 text-center mt-2">Groups cannot be created when session is not active</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : error ? (
                <p className="text-xs text-red-500 text-center py-8 px-4">{error}</p>
              ) : groups.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">No groups yet</p>
                  <p className="text-xs text-slate-400 mt-1">Create a group to start collaborating privately</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 p-2">
                  {groups.map(g => (
                    <button
                      key={g._id}
                      onClick={() => openGroup(g)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {g.group_name?.[0]?.toUpperCase() || 'G'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{g.group_name}</p>
                        <p className="text-xs text-slate-400">{g.participants?.length || 0} members</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── CHAT VIEW ── */}
        {selectedGroup && (
          <>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
              <button
                onClick={backToList}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{selectedGroup.group_name}</p>
                <p className="text-xs text-slate-400">{selectedGroup.participants?.length || 0} members · Private</p>
              </div>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
              >
                {leaving ? '...' : 'Leave'}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-xs text-slate-400 text-center pt-8">No messages yet. Say hello!</p>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.sender_name === selectedGroup.participants?.find(
                  p => p.user_id?.toString() === currentUserId?.toString()
                )?.name
                return (
                  <div key={i} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      isMine
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      {!isMine && (
                        <p className="text-[10px] font-bold mb-0.5 text-indigo-600">{msg.sender_name}</p>
                      )}
                      <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.message_text}</p>
                    </div>
                    <p className={`text-[10px] mt-0.5 text-slate-400 ${isMine ? 'pr-1' : 'pl-1'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input footer */}
            <div className="border-t border-slate-100 p-3 shrink-0 space-y-2">
              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">{error}</p>
              )}

              {/* Message input */}
              <form onSubmit={handleSend} className="flex gap-2">
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
                  maxLength={500}
                  rows={2}
                  disabled={!canSend || sendingMsg}
                  placeholder={canSend ? 'Type a message...' : 'Session not active'}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!canSend || !msgText.trim() || sendingMsg}
                  className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl self-end transition-colors shrink-0"
                >
                  {sendingMsg
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  }
                </button>
              </form>

              {/* Submit public question */}
              {canSubmitQ && !questionSubmitted && (
                <div>
                  {!showSubmitQ ? (
                    <button
                      onClick={() => setShowSubmitQ(true)}
                      className="w-full text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors border border-indigo-100"
                    >
                      Submit as Public Question →
                    </button>
                  ) : (
                    <form onSubmit={handleSubmitQuestion} className="flex flex-col gap-2">
                      <textarea
                        value={submitQText}
                        onChange={e => setSubmitQText(e.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="Type the question to submit publicly..."
                        className="w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowSubmitQ(false); setSubmitQText('') }}
                          className="flex-1 text-xs font-medium text-slate-500 border border-slate-200 rounded-xl py-2 hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!submitQText.trim() || submitting}
                          className="flex-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl py-2 transition-colors flex items-center justify-center gap-1.5"
                        >
                          {submitting && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                          Submit Publicly
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {questionSubmitted && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Question submitted to the public feed
                </div>
              )}
            </div>
          </>
        )}
      </div>
      </div>

      {showCreateModal && (
        <CreateGroupModal
          sessionId={sessionId}
          currentUserId={currentUserId}
          presenceParticipants={presenceParticipants}
          onCreate={() => { setShowCreateModal(false); fetchGroups() }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  )
}
