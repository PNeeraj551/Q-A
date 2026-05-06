import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getSessionById } from '../../api/sessions'
import { getComments, createComment, likeComment } from '../../api/comments'

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
    } catch {
      setSessionError('Failed to load session.')
    } finally {
      setSessionLoading(false)
    }
  }, [id])

  // Fetch initial comments — participants never see is_hidden=true (backend filters server-side)
  // Build threaded structure; filter hidden replies on client as defence layer
  const fetchComments = useCallback(async () => {
    setCommentsLoading(true)
    setCommentsError('')
    try {
      const res = await getComments(id, { limit: 50 })
      const fetched = res.data.comments
      const flat = [...fetched].reverse().filter((c) => !c.is_hidden) // chronological, no hidden
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

  // Handle session closing
  useEffect(() => {
    if (session?.session_status === 'CLOSED') {
      setShowClosedOverlay(true)
      const timer = setTimeout(() => {
        navigate('/sessions', { replace: true })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [session?.session_status, navigate])

  // Scroll to bottom when new comments arrive
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
      if (!comment) return
      // Filter hidden comments for participants
      if (comment.is_hidden) return
      if (seenIdsRef.current.has(comment._id)) return
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

    socket.on('session:state_changed', ({ new_status }) => {
      setSession((prev) => prev ? { ...prev, session_status: new_status } : prev)
    })

    socket.on('participant:revoked', ({ user_id }) => {
      const currentUserId = (() => {
        try {
          const token = localStorage.getItem('jwt')
          if (!token) return null
          const payload = JSON.parse(atob(token.split('.')[1]))
          return payload.user_id
        } catch {
          return null
        }
      })()
      if (currentUserId && user_id === currentUserId) {
        navigate('/sessions', { replace: true })
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

    const sessionStatus = session?.session_status
    if (sessionStatus === 'CLOSED') return

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

  const isClosed = session?.session_status === 'CLOSED'
  const canComment = session?.session_status === 'ACTIVE_SESSION'

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
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/sessions')}
          className="text-gray-500 hover:text-gray-700 transition shrink-0"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            {session?.session_title}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {isClosed ? (
              <span className="text-xs text-red-400 font-medium">Session ended</span>
            ) : (
              <>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    socketConnected ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <span className="text-xs text-gray-400">
                  {socketConnected ? 'Live' : 'Connecting...'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Session closed overlay */}
      {showClosedOverlay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform scale-100 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Session Closed</h2>
            <p className="text-sm text-gray-500 mb-6">
              The host has ended this session. You will be redirected to the homepage momentarily.
            </p>
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto" />
          </div>
        </div>
      )}

      {/* Session closed banner */}
      {isClosed && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-2 text-center text-xs text-red-500">
          This session has been closed. No further questions can be submitted.
        </div>
      )}

      {/* Comments feed — fills remaining height, scrollable */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
        {commentsLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!commentsLoading && commentsError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            {commentsError}
          </div>
        )}

        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No questions yet. Ask the first one!
          </div>
        )}

        {!commentsLoading && comments.map((comment) => {
          const likedByMe = (comment.liked_by || []).includes(currentUserId)
          const likeCount = (comment.liked_by || []).length
          const replyCount = (comment.replies || []).length
          const isExpanded = expandedReplies.has(comment._id)

          return (
            <div
              key={comment._id}
              className="flex gap-3 px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 select-none ${comment.is_admin_comment ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                {comment.participant_name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{comment.participant_name}</span>
                  {comment.is_admin_comment && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">Host</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

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
                  {canComment ? (
                    <button
                      onClick={() => toggleReplies(comment._id)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition font-medium"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'Reply' : 'Replies'}` : 'Reply'}
                    </button>
                  ) : (replyCount > 0 || isExpanded) && (
                    <button
                      onClick={() => toggleReplies(comment._id)}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium transition px-2 py-1"
                    >
                      {isExpanded ? 'Hide replies' : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                    </button>
                  )}
                </div>

                {/* Thread section */}
                {isExpanded && (
                  <div className="mt-3 border-l-2 border-gray-100 pl-3 space-y-3">
                    {(comment.replies || []).map(reply => {
                      const rLikedByMe = (reply.liked_by || []).includes(currentUserId)
                      const rLikeCount = (reply.liked_by || []).length
                      return (
                        <div key={reply._id} className="flex gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 select-none ${reply.is_admin_comment ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                            {reply.participant_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-gray-800">{reply.participant_name}</span>
                              {reply.is_admin_comment && <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded">Host</span>}
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

                    {canComment && (
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
                    )}
                  </div>
                )}
              </div>

            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-4 shrink-0">
        {submitError && (
          <p className="text-xs text-red-500 mb-2">{submitError}</p>
        )}
        {!canComment ? (
          <div className="text-center text-sm text-gray-400 py-1">
            {isClosed
              ? 'This session has ended.'
              : 'Waiting for the session to start...'}
          </div>
        ) : (
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value)
                setSubmitError('')
              }}
              maxLength={1000}
              disabled={submitLoading}
              placeholder="Ask a question..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={submitLoading || !commentText.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-1.5"
            >
              {submitLoading && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
