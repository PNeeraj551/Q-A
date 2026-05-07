import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getSessionById, updateSessionStatus, liveInviteParticipant } from '../../api/sessions'
import { getComments, createComment, likeComment, hideComment, deleteComment, editComment, removeComment } from '../../api/comments'
import axiosInstance from '../../api/axiosInstance'
import { searchUsers } from '../../api/users'
import ParticipantsDirectoryModal from '../../components/ParticipantsDirectoryModal'
import SessionEngagementOverview from '../../components/SessionEngagementOverview'
import AdminDMPanel from '../../components/AdminDMPanel'

export default function LiveSessionFeed() {
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

  const [closeLoading, setCloseLoading] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const [socketConnected, setSocketConnected] = useState(false)

  const [currentUserId, setCurrentUserId] = useState(null)
  const [expandedReplies, setExpandedReplies] = useState(new Set())
  const [replyInputs, setReplyInputs] = useState({})
  const [replyLoading, setReplyLoading] = useState({})

  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)
  const [presenceParticipants, setPresenceParticipants] = useState([])
  const [addParticipantOpen, setAddParticipantOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState([])
  const [adding, setAdding] = useState(null)
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

  // Fetch session details
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

  // Fetch initial comments and build threaded structure
  const fetchComments = useCallback(async () => {
    setCommentsLoading(true)
    setCommentsError('')
    try {
      const res = await getComments(id, { limit: 50 })
      const fetched = res.data.comments
      const flat = [...fetched].reverse() // chronological
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

  // Scroll to bottom when comments load or new top-level comment arrives
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments])

  // Socket setup
  useEffect(() => {
    const token = localStorage.getItem('jwt')
    const socket = io('/', {
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
      if (!comment || seenIdsRef.current.has(comment._id)) return
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
      setComments(prev => prev.map(c => {
        if (c._id === comment_id) return { ...c, is_hidden }
        const updatedReplies = (c.replies || []).map(r =>
          r._id === comment_id ? { ...r, is_hidden } : r
        )
        return { ...c, replies: updatedReplies }
      }))
    })

    socket.on('comment:deleted', ({ comment_id }) => {
      setComments(prev => prev
        .filter(c => c._id !== comment_id)
        .map(c => ({
          ...c,
          replies: (c.replies || []).filter(r => r._id !== comment_id),
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

    socket.on('session:state_changed', ({ new_status }) => {
      setSession((prev) => prev ? { ...prev, session_status: new_status } : prev)
      if (new_status === 'CLOSED') {
        navigate('/admin/sessions')
      }
    })

    socket.connect()

    return () => {
      socket.emit('session:leave', { session_id: id })
      socket.disconnect()
    }
  }, [id, navigate])

  async function handleSubmitComment(e) {
    e.preventDefault()
    const text = commentText.trim()
    if (!text) return
    setSubmitLoading(true)
    setSubmitError('')
    try {
      await createComment(id, text)
      setCommentText('')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to post comment.'
      setSubmitError(msg)
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleClose() {
    setCloseLoading(true)
    setCloseError('')
    try {
      await updateSessionStatus(id, 'CLOSED')
      navigate('/admin/sessions')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to close session.'
      setCloseError(msg)
    } finally {
      setCloseLoading(false)
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

  async function handleHide(commentId) {
    try { await hideComment(commentId) } catch {}
  }

  async function handleDelete(commentId) {
    try { await deleteComment(commentId) } catch {}
  }

  async function handleRemove(commentId) {
    try { await removeComment(commentId) } catch {}
  }

  async function handleEditSave(commentId) {
    const text = editText.trim()
    if (!text) return
    try {
      await editComment(commentId, text)
      setEditingId(null)
      setEditText('')
    } catch {}
  }

  async function openDM() {
    setDmOpen(true)
    try {
      const res = await axiosInstance.get(`/sessions/${id}/presence`)
      setPresenceParticipants(res.data.participants || [])
    } catch {}
  }

  if (sessionLoading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className="h-screen bg-white flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-600">
          {sessionError}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/admin/sessions')}
            className="text-gray-400 hover:text-gray-700 transition shrink-0"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{session?.session_title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-400">{socketConnected ? 'Live' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDirectoryOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Participants
          </button>
          <button
            onClick={openDM}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Message
          </button>
          <button
            onClick={() => { setAddParticipantOpen(true); setAddQuery(''); setAddResults([]) }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add
          </button>
          {session?.session_status === 'ACTIVE_SESSION' && (
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium"
            >
              Close Session
            </button>
          )}
        </div>
      </div>

      <ParticipantsDirectoryModal
        sessionId={id}
        isOpen={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        socket={socketRef.current}
        currentUserId={currentUserId}
        userRole="admin"
        onCoordinate={() => {}}
      />

      {/* Session Engagement Analytics — collapsible */}
      <div className="border-b border-gray-100 shrink-0">
        <button
          onClick={() => setAnalyticsOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span>Session Engagement</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {analyticsOpen && (
          <div className="px-4 sm:px-6 pb-4">
            <SessionEngagementOverview sessionId={id} socket={socketRef.current} />
          </div>
        )}
      </div>

      {/* Comments feed */}
      <div className="flex-1 overflow-y-auto py-2">
        {commentsLoading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!commentsLoading && commentsError && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            {commentsError}
          </div>
        )}
        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">No comments yet.</div>
        )}

        {!commentsLoading && comments.map((comment) => {
          const likedByMe = (comment.liked_by || []).includes(currentUserId)
          const likeCount = (comment.liked_by || []).length
          const replyCount = (comment.replies || []).length
          const isExpanded = expandedReplies.has(comment._id)

          return (
            <div
              key={comment._id}
              className={`flex gap-3 px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors ${comment.is_hidden ? 'opacity-50' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 select-none ${comment.is_admin_comment ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                {comment.participant_name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Name row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{comment.participant_name}</span>
                  {comment.is_admin_comment && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">Admin</span>
                  )}
                  {comment.is_hidden && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Hidden</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message */}
                {editingId === comment._id ? (
                  <div className="mt-1 flex gap-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      autoFocus
                    />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleEditSave(comment._id)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                    {comment.comment_text}
                  </p>
                )}

                {/* Action bar */}
                <div className="flex items-center gap-0.5 mt-2 flex-wrap">
                  <button
                    onClick={() => handleLike(comment._id)}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition font-medium ${
                      likedByMe
                        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill={likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {likeCount > 0 ? likeCount : 'Like'}
                  </button>
                  <button
                    onClick={() => toggleReplies(comment._id)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'Reply' : 'Replies'}` : 'Reply'}
                  </button>
                  <div className="w-px h-3.5 bg-gray-200 mx-0.5" />
                  <button
                    onClick={() => handleHide(comment._id)}
                    title={comment.is_hidden ? 'Unhide' : 'Hide'}
                    className={`p-1.5 rounded transition ${comment.is_hidden ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'}`}
                  >
                    {comment.is_hidden ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                  {comment.is_admin_comment && (
                    <button
                      onClick={() => { setEditingId(comment._id); setEditText(comment.comment_text) }}
                      title="Edit"
                      className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(comment._id)}
                    title="Remove"
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Thread section */}
                {isExpanded && (
                  <div className="mt-3 border-l-2 border-gray-100 pl-3 space-y-3">
                    {(comment.replies || []).map(reply => {
                      const rLikedByMe = (reply.liked_by || []).includes(currentUserId)
                      const rLikeCount = (reply.liked_by || []).length
                      return (
                        <div key={reply._id} className={`flex gap-2 ${reply.is_hidden ? 'opacity-50' : ''}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 select-none ${reply.is_admin_comment ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                            {reply.participant_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-gray-800">{reply.participant_name}</span>
                              {reply.is_admin_comment && <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded">Admin</span>}
                              {reply.is_hidden && <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded">Hidden</span>}
                              <span className="text-xs text-gray-400">
                                {new Date(reply.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{reply.comment_text}</p>
                            <div className="flex items-center gap-0.5 mt-1">
                              <button
                                onClick={() => handleLike(reply._id)}
                                className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition ${
                                  rLikedByMe ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                <svg className="w-3 h-3" fill={rLikedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                                {rLikeCount > 0 ? rLikeCount : 'Like'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Reply input */}
                    <form onSubmit={(e) => handleReply(e, comment._id)} className="flex gap-2">
                      <input
                        type="text"
                        value={replyInputs[comment._id] || ''}
                        onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment._id]: e.target.value }))}
                        maxLength={1000}
                        placeholder="Reply..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                      />
                      <button
                        type="submit"
                        disabled={replyLoading[comment._id] || !(replyInputs[comment._id] || '').trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition"
                      >
                        {replyLoading[comment._id] ? '...' : 'Send'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      <div className="border-t border-gray-200 px-4 sm:px-6 py-4 shrink-0">
        {submitError && <p className="text-xs text-red-500 mb-2">{submitError}</p>}
        <form onSubmit={handleSubmitComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => { setCommentText(e.target.value); setSubmitError('') }}
            maxLength={1000}
            disabled={submitLoading || session?.session_status === 'CLOSED'}
            placeholder={session?.session_status === 'CLOSED' ? 'Session is closed' : 'Reply as admin...'}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={submitLoading || !commentText.trim() || session?.session_status === 'CLOSED'}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            {submitLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Send
          </button>
        </form>
      </div>

      {dmOpen && (
        <AdminDMPanel
          sessionId={id}
          socket={socketRef.current}
          presenceParticipants={presenceParticipants}
          onClose={() => setDmOpen(false)}
        />
      )}

      {/* Add Participant Modal */}
      {addParticipantOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Add Participant</h2>
              <button
                onClick={() => setAddParticipantOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={addQuery}
                onChange={async (e) => {
                  const q = e.target.value
                  setAddQuery(q)
                  if (q.trim().length < 1) { setAddResults([]); return }
                  try {
                    const res = await searchUsers(q.trim())
                    setAddResults((res.data.users || []).filter(u => u.role === 'participant' && u.is_active))
                  } catch { setAddResults([]) }
                }}
                placeholder="Search by name or email..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all mb-3"
              />
              {addResults.length === 0 && addQuery.trim() && (
                <p className="text-xs text-slate-400 text-center py-4">No participants found</p>
              )}
              {addResults.length === 0 && !addQuery.trim() && (
                <p className="text-xs text-slate-400 text-center py-4">Type a name to search</p>
              )}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                {addResults.map(u => (
                  <div key={u._id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <button
                      disabled={adding === u._id}
                      onClick={async () => {
                        setAdding(u._id)
                        try {
                          await liveInviteParticipant(id, u._id)
                          setAddResults(prev => prev.filter(p => p._id !== u._id))
                        } catch {}
                        finally { setAdding(null) }
                      }}
                      className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 rounded-xl transition-colors shrink-0"
                    >
                      {adding === u._id ? '...' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Confirmation Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Close Session</h2>
            <p className="text-sm text-gray-600 mb-4">Closing the session will stop all activity. This cannot be undone.</p>
            {closeError && <p className="text-xs text-red-500 mb-3">{closeError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCloseConfirm(false); setCloseError('') }}
                disabled={closeLoading}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={closeLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition flex items-center gap-2"
              >
                {closeLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {closeLoading ? 'Closing...' : 'Close Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
