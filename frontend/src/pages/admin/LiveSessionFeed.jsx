import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getSessionById, updateSessionStatus } from '../../api/sessions'
import { getComments, createComment, likeComment, hideComment, deleteComment, pinComment } from '../../api/comments'

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
    } catch {
      setSessionError('Failed to load session.')
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
    } catch {
      setCommentsError('Failed to load comments.')
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

    socket.on('comment:pinned', ({ comment_id, admin_pinned }) => {
      setComments(prev => prev.map(c => {
        if (c._id === comment_id) return { ...c, admin_pinned }
        const updatedReplies = (c.replies || []).map(r =>
          r._id === comment_id ? { ...r, admin_pinned } : r
        )
        return { ...c, replies: updatedReplies }
      }))
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

  async function handlePin(commentId) {
    try { await pinComment(commentId) } catch {}
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
        {session?.session_status === 'ACTIVE_SESSION' && (
          <button
            onClick={() => setShowCloseConfirm(true)}
            className="shrink-0 text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium"
          >
            Close Session
          </button>
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
                  {comment.admin_pinned && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">Pinned</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message */}
                <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                  {comment.comment_text}
                </p>

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
                  <button
                    onClick={() => handlePin(comment._id)}
                    title={comment.admin_pinned ? 'Unpin' : 'Pin'}
                    className={`p-1.5 rounded transition ${comment.admin_pinned ? 'text-orange-500 hover:bg-orange-50' : 'text-gray-300 hover:text-orange-500 hover:bg-orange-50'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill={comment.admin_pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(comment._id)}
                    title="Delete"
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
