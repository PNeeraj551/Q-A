import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../../api/socketUrl'
import { getSessionById } from '../../api/sessions'
import { getComments, createComment, likeComment, editComment, removeComment } from '../../api/comments'
import ParticipantsDirectoryModal from '../../components/ParticipantsDirectoryModal'
import CollaborationPanel from '../../components/CollaborationPanel'
import AdminDMModal from '../../components/AdminDMModal'

export default function SessionFeedPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState('')

  const [commentText, setCommentText] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [socketConnected, setSocketConnected] = useState(false)
  const [showClosedOverlay, setShowClosedOverlay] = useState(false)

  const [currentUserId, setCurrentUserId] = useState(null)
  const [expandedReplies, setExpandedReplies] = useState(new Set())
  const [replyInputs, setReplyInputs] = useState({})
  const [replyLoading, setReplyLoading] = useState({})

  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [collabPanelOpen, setCollabPanelOpen] = useState(false)
  const [presenceParticipants, setPresenceParticipants] = useState([])
  const [adminDMOpen, setAdminDMOpen] = useState(false)
  const [adminDMNotif, setAdminDMNotif] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  const socketRef = useRef(null)
  const bottomRef = useRef(null)
  const seenIdsRef = useRef(new Set())

  // Decode currentUserId from JWT once on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('jwt')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setCurrentUserId(payload.user_id)
      }
    } catch {}
  }, [])

  const fetchSession = useCallback(async () => {
    setSessionLoading(true)
    setSessionError('')
    try {
      const res = await getSessionById(id)
      setSession(res.data.session)
    } catch (err) {
      setSessionError(err.response?.data?.message || 'Failed to load session.')
    } finally {
      setSessionLoading(false)
    }
  }, [id])

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true)
    setCommentsError('')
    try {
      const res = await getComments(id, { limit: 50 })
      const fetched = res.data.comments
      const flat = [...fetched].reverse().filter((c) => !c.is_hidden)
      const topLevel = flat.filter(c => !c.parent_id).map(c => ({ ...c, replies: [] }))
      const replies = flat.filter(c => c.parent_id)
      replies.forEach(reply => {
        const parent = topLevel.find(c => c._id === reply.parent_id)
        if (parent) parent.replies.push(reply)
      })
      setComments(topLevel)
      flat.forEach((c) => seenIdsRef.current.add(c._id))
    } catch (err) {
      setCommentsError(err.response?.data?.message || 'Failed to load comments.')
    } finally {
      setCommentsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchSession()
    fetchComments()
  }, [fetchSession, fetchComments])

  const initialStatusRef = useRef(null)
  useEffect(() => {
    if (session && initialStatusRef.current === null) {
      initialStatusRef.current = session.session_status
    }
  }, [session])

  useEffect(() => {
    if (session?.session_status === 'CLOSED' && initialStatusRef.current && initialStatusRef.current !== 'CLOSED') {
      setShowClosedOverlay(true)
      const timer = setTimeout(() => {
        navigate('/participant/sessions', { replace: true })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [session?.session_status, navigate])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments])

  useEffect(() => {
    const token = localStorage.getItem('jwt')
    const socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token },
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      socket.emit('session:join', { session_id: id })
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
    })

    socket.on('comment:new', ({ comment }) => {
      if (!comment || comment.is_hidden || seenIdsRef.current.has(comment._id)) return
      seenIdsRef.current.add(comment._id)
      if (comment.parent_id) {
        setComments(prev => prev.map(c =>
          c._id === comment.parent_id
            ? { ...c, replies: [...(c.replies || []), comment] }
            : c
        ))
      } else {
        setComments(prev => [...prev, { ...comment, replies: [] }])
      }
    })

    socket.on('comment:liked', ({ comment_id, liked_by_ids, like_count }) => {
      setComments(prev => prev.map(c => {
        if (c._id === comment_id) return { ...c, liked_by: liked_by_ids, like_count }
        const updatedReplies = (c.replies || []).map(r =>
          r._id === comment_id ? { ...r, liked_by: liked_by_ids, like_count } : r
        )
        return { ...c, replies: updatedReplies }
      }))
    })

    socket.on('comment:hidden', ({ comment_id, is_hidden }) => {
      if (is_hidden) {
        setComments(prev => prev
          .filter(c => c._id !== comment_id)
          .map(c => ({
            ...c,
            replies: (c.replies || []).filter(r => r._id !== comment_id)
          }))
        )
      }
    })

    socket.on('comment:deleted', ({ comment_id }) => {
      setComments(prev => prev
        .filter(c => c._id !== comment_id)
        .map(c => ({
          ...c,
          replies: (c.replies || []).filter(r => r._id !== comment_id)
        }))
      )
    })

    socket.on('comment:edited', ({ comment_id, comment_text, updated_at }) => {
      setComments(prev => prev.map(c => {
        if (c._id === comment_id) return { ...c, comment_text, updated_at }
        const updatedReplies = (c.replies || []).map(r =>
          r._id === comment_id ? { ...r, comment_text, updated_at } : r
        )
        return { ...c, replies: updatedReplies }
      }))
    })

    socket.on('comment:removed', ({ comment_id }) => {
      setComments(prev => prev
        .filter(c => c._id !== comment_id)
        .map(c => ({
          ...c,
          replies: (c.replies || []).filter(r => r._id !== comment_id),
        }))
      )
    })

    socket.on('session:invited', () => {
      fetchSession()
    })

    socket.on('session:state_changed', ({ new_status }) => {
      setSession((prev) => prev ? { ...prev, session_status: new_status } : prev)
    })

    socket.on('participant:revoked', ({ user_id }) => {
      if (currentUserId && user_id === currentUserId) {
        navigate('/sessions', { replace: true })
      }
    })

    socket.on('peer:presence_update', ({ participants }) => {
      setPresenceParticipants(participants || [])
    })

    socket.on('private:received', () => {
      setAdminDMNotif(true)
    })

    socket.on('private:message', () => {
      setAdminDMNotif(true)
    })

    socket.connect()

    return () => {
      socket.emit('session:leave', { session_id: id })
      socket.disconnect()
    }
  }, [id, navigate, currentUserId])

  async function handleSubmitComment(e) {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || session?.session_status === 'CLOSED') return

    setSubmitLoading(true)
    setSubmitError('')
    try {
      await createComment(id, text)
      setCommentText('')
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to post comment.')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleLike(commentId) {
    try {
      const res = await likeComment(commentId)
      const { liked_by_ids, like_count } = res.data
      setComments(prev => prev.map(c => {
        if (c._id === commentId) return { ...c, liked_by: liked_by_ids, like_count }
        const updatedReplies = (c.replies || []).map(r =>
          r._id === commentId ? { ...r, liked_by: liked_by_ids, like_count } : r
        )
        return { ...c, replies: updatedReplies }
      }))
    } catch {}
  }

  function toggleReplies(commentId) {
    setExpandedReplies(prev => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  async function handleReply(e, parentId) {
    e.preventDefault()
    const text = (replyInputs[parentId] || '').trim()
    if (!text) return
    setReplyLoading(prev => ({ ...prev, [parentId]: true }))
    try {
      await createComment(id, text, parentId)
      setReplyInputs(prev => ({ ...prev, [parentId]: '' }))
    } catch {}
    finally {
      setReplyLoading(prev => ({ ...prev, [parentId]: false }))
    }
  }

  function applyRemoveLocal(commentId) {
    setComments(prev => prev
      .filter(c => c._id !== commentId)
      .map(c => ({ ...c, replies: (c.replies || []).filter(r => r._id !== commentId) }))
    )
  }

  function applyEditLocal(commentId, text) {
    const updated_at = new Date().toISOString()
    setComments(prev => prev.map(c => {
      if (c._id === commentId) return { ...c, comment_text: text, updated_at }
      return { ...c, replies: (c.replies || []).map(r => r._id === commentId ? { ...r, comment_text: text, updated_at } : r) }
    }))
  }

  async function handleRemove(commentId) {
    applyRemoveLocal(commentId)
    try { await removeComment(commentId) } catch {}
  }

  async function handleEditSave(commentId) {
    const text = editText.trim()
    if (!text) return
    try {
      await editComment(commentId, text)
      applyEditLocal(commentId, text)
      setEditingId(null)
      setEditText('')
    } catch {}
  }

  const isClosed = session?.session_status === 'CLOSED'
  const canComment = session?.session_status === 'ACTIVE_SESSION'

  if (sessionLoading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-600">
          {sessionError}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between gap-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate('/sessions')}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate leading-tight">
              {session?.session_title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-xs font-medium text-slate-500">
                {isClosed ? 'Session ended' : socketConnected ? 'Live Connection' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isClosed && (
            <button
              onClick={() => setDirectoryOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Participants
            </button>
          )}
          {!isClosed && (
            <button
              onClick={() => setCollabPanelOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              Collaborate
            </button>
          )}
        </div>
      </header>

      <ParticipantsDirectoryModal
        sessionId={id}
        isOpen={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        socket={socketRef.current}
        currentUserId={currentUserId}
        userRole="participant"
        onCoordinate={() => { setDirectoryOpen(false); setCollabPanelOpen(true) }}
      />

      {collabPanelOpen && (
        <CollaborationPanel
          sessionId={id}
          socket={socketRef.current}
          currentUserId={currentUserId}
          sessionStatus={session?.session_status}
          presenceParticipants={presenceParticipants}
          onClose={() => setCollabPanelOpen(false)}
        />
      )}

      {adminDMOpen && (
        <AdminDMModal
          sessionId={id}
          socket={socketRef.current}
          onClose={() => { setAdminDMOpen(false); setAdminDMNotif(false) }}
        />
      )}

      {!isClosed && !adminDMOpen && (
        <button
          onClick={() => { setAdminDMOpen(true); setAdminDMNotif(false) }}
          className="fixed bottom-24 right-4 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-md hover:bg-slate-50 transition-colors z-30"
        >
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Host
          {adminDMNotif && (
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          )}
        </button>
      )}

      {/* Session closed overlay */}
      {showClosedOverlay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center transform animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Session Ended</h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
              This session has been closed by the host. You'll be redirected shortly.
            </p>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      )}

      {/* Comments feed */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4 bg-slate-50/50">
        {commentsLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!commentsLoading && commentsError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-600">
            {commentsError}
          </div>
        )}

        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 opacity-50">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No questions yet</p>
            <p className="text-slate-400 text-sm mt-1">Be the first to ask something!</p>
          </div>
        )}

        {/* Pinned comments first or mixed? Usually pins are highlighted. */}
        {!commentsLoading && comments.map((comment) => {
          const likedByMe = (comment.liked_by || []).includes(currentUserId)
          const likeCount = (comment.liked_by || []).length
          const replyCount = (comment.replies || []).length
          const isExpanded = expandedReplies.has(comment._id)

          return (
            <div
              key={comment._id}
              className="group flex gap-4 p-4 rounded-2xl transition-all duration-200 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm"
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 select-none shadow-sm ${
                comment.is_admin_comment 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {comment.participant_name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-slate-900">{comment.participant_name}</span>
                  {comment.is_admin_comment && (
                    <span className="text-[10px] uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">Host</span>
                  )}
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(comment.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {editingId === comment._id ? (
                  <div className="mt-1 flex gap-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      autoFocus
                    />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleEditSave(comment._id)} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                    {comment.comment_text}
                  </p>
                )}

                {/* Action bar */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleLike(comment._id)}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all font-semibold ${
                      likedByMe
                        ? 'text-indigo-600 bg-indigo-50 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {likeCount > 0 ? likeCount : 'Like'}
                  </button>

                  <button
                    onClick={() => toggleReplies(comment._id)}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all font-semibold ${
                      isExpanded
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'Reply' : 'Replies'}` : 'Reply'}
                  </button>

                  {comment.participant_id === currentUserId && !comment.is_admin_comment && (
                    <>
                      <button
                        onClick={() => { setEditingId(comment._id); setEditText(comment.comment_text) }}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemove(comment._id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {/* Thread section */}
                {isExpanded && (
                  <div className="mt-4 border-l-2 border-slate-100 pl-4 space-y-4">
                    {(comment.replies || []).map(reply => {
                      const rLikedByMe = (reply.liked_by || []).includes(currentUserId)
                      const rLikeCount = (reply.liked_by || []).length
                      const isMyReply = reply.participant_id === currentUserId && !reply.is_admin_comment
                      return (
                        <div key={reply._id} className="flex gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm ${
                            reply.is_admin_comment ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {reply.participant_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-xs font-bold text-slate-900">{reply.participant_name}</span>
                              {reply.is_admin_comment && <span className="text-[9px] uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold">Host</span>}
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(reply.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {editingId === reply._id ? (
                              <div className="flex gap-2 mt-1">
                                <textarea
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  rows={2}
                                  maxLength={1000}
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => handleEditSave(reply._id)} className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700">Save</button>
                                  <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600 leading-relaxed">{reply.comment_text}</p>
                            )}
                            <div className="flex items-center gap-1 mt-1">
                              <button
                                onClick={() => handleLike(reply._id)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold transition-colors ${
                                  rLikedByMe ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                <svg className="w-3 h-3" fill={rLikedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                                {rLikeCount > 0 ? rLikeCount : 'Like'}
                              </button>
                              {isMyReply && (
                                <>
                                  <button
                                    onClick={() => { setEditingId(reply._id); setEditText(reply.comment_text) }}
                                    className="p-1 text-slate-300 hover:text-indigo-500 rounded transition"
                                    title="Edit"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleRemove(reply._id)}
                                    className="p-1 text-slate-300 hover:text-red-500 rounded transition"
                                    title="Remove"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {canComment && (
                      <form onSubmit={(e) => handleReply(e, comment._id)} className="flex gap-2">
                        <input
                          type="text"
                          value={replyInputs[comment._id] || ''}
                          onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment._id]: e.target.value }))}
                          maxLength={1000}
                          placeholder="Write a reply..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                        />
                        <button
                          type="submit"
                          disabled={replyLoading[comment._id] || !(replyInputs[comment._id] || '').trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-sm"
                        >
                          {replyLoading[comment._id] ? '...' : 'Reply'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Comment input area */}
      <div className="bg-white border-t border-slate-200 px-4 sm:px-8 py-5 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
        {submitError && (
          <p className="text-xs text-red-500 mb-3 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}
        
        {!canComment ? (
          <div className="text-center bg-slate-50 border border-slate-100 rounded-2xl py-3 text-sm text-slate-400 font-medium italic">
            {isClosed ? 'This session has ended.' : 'Waiting for the session to start...'}
          </div>
        ) : (
          <form onSubmit={handleSubmitComment} className="flex gap-3 max-w-5xl mx-auto">
            <div className="flex-1 relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => {
                  setCommentText(e.target.value)
                  setSubmitError('')
                }}
                maxLength={1000}
                disabled={submitLoading}
                placeholder="Ask a question to the host..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={submitLoading || !commentText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-8 py-3.5 rounded-2xl transition-all shadow-md flex items-center gap-2 active:scale-95"
            >
              {submitLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
