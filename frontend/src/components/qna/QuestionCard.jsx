import { useEffect, useRef, useState } from 'react'
import { ThumbsUp, Send } from 'lucide-react'
import supabase from '../../utils/supabase'
import { Button } from '@/components/common/Button'
import { Skeleton } from '@/components/common/Skeleton'
import { textareaCls } from '@/utils/ui'
import { getRelativeTime } from '@/utils/utils'
import { listReplies, createReply, updateReply, deleteReply, toggleReplyLike } from '../../api/replies'
import { updateQuestion, deleteQuestion, toggleLike, acceptReply, trackView } from '../../api/questions'
import { InlineConfirm } from '../common/InlineConfirm'
import toast from 'react-hot-toast'

// ───────────────────────── REPLY THREAD ─────────────────────────
export function ReplyThread({ qnaId, question, currentUserId, isAdmin, isClosed, onAccept }) {
  const [replies, setReplies] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [replyText, setReplyText] = useState('')
  const submittingRef = useRef(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [replyMenuId, setReplyMenuId] = useState(null)
  const deletingRepliesRef = useRef(new Set())
  const savingRepliesRef = useRef(new Set())
  const likingRepliesRef = useRef(new Set())
  const acceptingRef = useRef(false)

  const acceptedId = question.accepted_reply_id ? String(question.accepted_reply_id) : null

  useEffect(() => {
    listReplies(qnaId, question.id)
      .then((res) => setReplies(res.data.replies || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoaded(true))
  }, [qnaId, question.id, retryCount])

  useEffect(() => {
    const channel = supabase
      .channel(`qna_${qnaId}`)
      .on('broadcast', { event: 'reply:new' }, ({ payload: { reply, question_id } }) => {
        if (String(question_id) !== String(question.id)) return
        setReplies((prev) => {
          if (prev.some((r) => r.id === reply.id)) return prev
          const optIdx = prev.findIndex((r) => r._isOptimistic && String(r.author_id) === String(reply.author_id) && r.text === reply.text)
          if (optIdx !== -1) { const next = [...prev]; next[optIdx] = reply; return next }
          return [...prev, reply]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [question.id])

  useEffect(() => {
    if (!replyMenuId) return
    function handleClick(e) {
      if (!e.target.closest('[data-reply-menu]')) setReplyMenuId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [replyMenuId])

  async function handleSubmitReply(e) {
    e.preventDefault()
    const text = replyText.trim()
    if (!text || submittingRef.current) return
    submittingRef.current = true
    const tempId = 'temp_' + Date.now()
    setReplies((prev) => [...prev, {
      id: tempId, text, author_id: currentUserId,
      author_name: 'You', created_at: new Date().toISOString(), _isOptimistic: true,
    }])
    setReplyText('')
    try {
      const res = await createReply(qnaId, question.id, text)
      setReplies((prev) => prev.map((r) => (r.id === tempId ? res.data.reply : r)))
    } catch {
      setReplies((prev) => prev.filter((r) => r.id !== tempId))
      setReplyText(text)
      toast.error('Failed to post reply.')
    } finally {
      submittingRef.current = false
    }
  }

  async function handleDeleteReply(rId) {
    if (deletingRepliesRef.current.has(rId)) return
    deletingRepliesRef.current.add(rId)
    const backup = replies.find((r) => r.id === rId)
    setReplies((prev) => prev.filter((r) => r.id !== rId))
    try {
      await deleteReply(qnaId, question.id, rId)
    } catch {
      if (backup) setReplies((prev) => [...prev, backup].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      toast.error('Failed to delete reply.')
    } finally {
      deletingRepliesRef.current.delete(rId)
    }
  }

  async function handleSaveEdit(rId) {
    const text = editText.trim()
    if (!text || savingRepliesRef.current.has(rId)) return
    savingRepliesRef.current.add(rId)
    const original = replies.find((r) => r.id === rId)
    setReplies((prev) => prev.map((r) => (r.id === rId ? { ...r, text } : r)))
    setEditingId(null)
    try {
      const res = await updateReply(qnaId, question.id, rId, text)
      setReplies((prev) => prev.map((r) => (r.id === rId ? res.data.reply : r)))
      toast.success('Reply updated.')
    } catch {
      if (original) setReplies((prev) => prev.map((r) => (r.id === rId ? original : r)))
      toast.error('Failed to update reply.')
    } finally {
      savingRepliesRef.current.delete(rId)
    }
  }

  async function handleToggleAccept(rId) {
    if (acceptingRef.current) return
    acceptingRef.current = true
    const newId = acceptedId === rId ? null : rId
    try {
      const res = await acceptReply(qnaId, question.id, newId)
      onAccept(res.data.question)
    } catch {
      toast.error('Failed to update accepted solution.')
    } finally {
      acceptingRef.current = false
    }
  }

  async function handleReplyLike(reply) {
    if (likingRepliesRef.current.has(reply.id)) return
    likingRepliesRef.current.add(reply.id)
    const optimistic = {
      ...reply,
      liked_by_me: !reply.liked_by_me,
      likes_count: reply.liked_by_me ? reply.likes_count - 1 : reply.likes_count + 1,
    }
    setReplies((prev) => prev.map((r) => (r.id === reply.id ? optimistic : r)))
    try {
      const res = await toggleReplyLike(qnaId, question.id, reply.id)
      setReplies((prev) =>
        prev.map((r) => (r.id === reply.id ? { ...r, liked_by_me: res.data.liked_by_me, likes_count: res.data.likes_count } : r))
      )
    } catch {
      setReplies((prev) => prev.map((r) => (r.id === reply.id ? reply : r)))
    } finally {
      likingRepliesRef.current.delete(reply.id)
    }
  }

  const canAccept = (question.author_id === currentUserId || isAdmin) && !isClosed

  // Skeleton while loading
  if (!loaded) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loaded && loadError) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-400 pl-1">
          Failed to load replies.{' '}
          <button
            className="text-blue-500 hover:underline"
            onClick={() => { setLoadError(false); setLoaded(false); setRetryCount((c) => c + 1) }}
          >
            Retry
          </button>
        </p>
      </div>
    )
  }

  // Sort: accepted reply first, then chronological
  const sorted = [...replies].sort((a, b) => {
    if (acceptedId && String(a.id) === acceptedId) return -1
    if (acceptedId && String(b.id) === acceptedId) return 1
    return new Date(a.created_at) - new Date(b.created_at)
  })

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      {replies.length === 0 && (
        <p className="text-xs text-slate-400 pl-1">Be the first to answer.</p>
      )}

      {sorted.length > 0 && (
        <div className="ml-3 border-l border-slate-100 pl-3 space-y-3">
          {sorted.map((r) => {
            const isAccepted = acceptedId && String(r.id) === acceptedId
            return (
              <div
                key={r.id}
                className={`flex items-start gap-2.5 group rounded-lg p-1.5 -mx-1.5 transition-colors duration-150 ${
                  isAccepted ? 'border border-emerald-200 bg-emerald-50/50 rounded-lg p-2.5 -mx-1.5' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0 mt-0.5">
                  {r.author_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  {isAccepted && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Accepted Solution
                      </span>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-slate-900">
                    {r.author_name}
                    {r.created_at && (
                      <span className="ml-2 font-normal text-slate-400">{getRelativeTime(r.created_at)}</span>
                    )}
                  </p>
                  {editingId === r.id ? (
                    <div className="mt-1.5 space-y-2">
                      <textarea
                        className={textareaCls}
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        maxLength={5000}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(r.id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{r.text}</p>
                  )}
                  {editingId !== r.id && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        onClick={() => !isClosed && !r._isOptimistic && handleReplyLike(r)}
                        aria-label={r.liked_by_me ? 'Unlike reply' : 'Like reply'}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-100 select-none ${
                          isClosed || r._isOptimistic
                            ? 'border-slate-100 text-slate-300 cursor-default'
                            : r.liked_by_me
                              ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-50 active:scale-105'
                              : 'bg-transparent border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-500 active:scale-105'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" strokeWidth={1.75} />
                        {r.likes_count > 0 && <span>{r.likes_count}</span>}
                      </button>
                    </div>
                  )}
                </div>
                {(canAccept || (!isClosed && (r.author_id === currentUserId || isAdmin))) && !r._isOptimistic && editingId !== r.id && (
                  <div className="relative shrink-0 self-start mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150" data-reply-menu>
                    <button
                      onClick={() => setReplyMenuId(replyMenuId === r.id ? null : r.id)}
                      className="p-1 rounded text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150"
                      aria-label="Reply options"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.25" />
                        <circle cx="12" cy="12" r="1.25" />
                        <circle cx="12" cy="19" r="1.25" />
                      </svg>
                    </button>
                    {replyMenuId === r.id && (
                      <div className="absolute right-0 top-6 z-20 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 overflow-hidden">
                        {canAccept && (
                          <button
                            onClick={() => { setReplyMenuId(null); handleToggleAccept(r.id) }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-100 ${
                              isAccepted ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            {isAccepted ? 'Remove accepted' : 'Mark as accepted'}
                          </button>
                        )}
                        {r.author_id === currentUserId && !isClosed && (
                          <button
                            onClick={() => { setReplyMenuId(null); setEditingId(r.id); setEditText(r.text) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors duration-100"
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                            Edit
                          </button>
                        )}
                        {(r.author_id === currentUserId || isAdmin) && !isClosed && (
                          <button
                            onClick={() => { setReplyMenuId(null); handleDeleteReply(r.id) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors duration-100"
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isClosed && (
        <form onSubmit={handleSubmitReply} className="mt-3 ml-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-full px-4 py-2 bg-white focus-within:border-slate-300 transition-colors duration-150">
            <input
              className="flex-1 text-sm bg-transparent border-0 outline-none text-slate-900 placeholder:text-slate-400"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your comments here..."
              maxLength={5000}
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-150 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ───────────────────────── QUESTION CARD ─────────────────────────
export function QuestionCard({ qnaId, question, currentUserId, isAdmin, isClosed, onUpdate, onDelete }) {
  const [showReplies, setShowReplies] = useState(false)
  const [viewCount, setViewCount] = useState(question.view_count ?? 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const likingRef = useRef(false)
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  const hasViewedRef = useRef(false)
  const editRef = useRef(null)
  const menuRef = useRef(null)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState(question.text)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (editMode && editRef.current) {
      const el = editRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editMode])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function handleLike() {
    if (likingRef.current) return
    likingRef.current = true
    setTimeout(() => { likingRef.current = false }, 300)
    const optimistic = {
      ...question,
      liked_by_me: !question.liked_by_me,
      likes_count: question.liked_by_me ? question.likes_count - 1 : question.likes_count + 1,
    }
    onUpdate(optimistic)
    try {
      const res = await toggleLike(qnaId, question.id)
      onUpdate({ ...question, liked_by_me: res.data.liked_by_me, likes_count: res.data.likes_count })
    } catch {
      onUpdate(question)
    }
  }

  async function handleSaveEdit() {
    const text = editText.trim()
    if (!text || text === question.text || savingRef.current) { setEditMode(false); return }
    savingRef.current = true
    const original = question.text
    onUpdate({ ...question, text })
    setEditMode(false)
    try {
      const res = await updateQuestion(qnaId, question.id, text)
      onUpdate(res.data.question)
      toast.success('Question updated.')
    } catch {
      onUpdate({ ...question, text: original })
      toast.error('Failed to update question.')
    } finally {
      savingRef.current = false
    }
  }

  async function handleDelete() {
    if (deletingRef.current) return
    deletingRef.current = true
    onDelete(question.id)
    try {
      await deleteQuestion(qnaId, question.id)
      toast.success('Question deleted.')
    } catch {
      toast.error('Failed to delete question.')
    }
  }

  function handleEditFromMenu() {
    setMenuOpen(false)
    setEditMode(true)
    setEditText(question.text)
  }

  function handleDeleteFromMenu() {
    setMenuOpen(false)
    setConfirmDelete(true)
  }

  function handleReplyToggle() {
    const next = !showReplies
    setShowReplies(next)
    if (next && !hasViewedRef.current) {
      hasViewedRef.current = true
      setViewCount(c => c + 1)
      trackView(qnaId, question.id).catch(() => {})
    }
  }

  const canModify = question.author_id === currentUserId || isAdmin
  const replyCount = question.reply_count ?? 0

  const initial = question.author_name?.[0]?.toUpperCase() || '?'
  const avatarColor =
    initial >= 'A' && initial <= 'G' ? 'bg-violet-100 text-violet-700' :
    initial >= 'H' && initial <= 'N' ? 'bg-blue-100 text-blue-700' :
    'bg-emerald-100 text-emerald-700'

  // SVG paths (reused in multiple places)
  const pencilPath = 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
  const trashPath = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'

  const chatPath = 'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all duration-200 group">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${avatarColor}`}>
            {initial}
          </div>
          <div className="flex items-baseline gap-0 min-w-0">
            <span className="text-sm font-semibold text-slate-800 truncate">{question.author_name}</span>
            {question.created_at && (
              <>
                <span className="mx-1.5 text-slate-300 text-xs select-none">•</span>
                <span className="text-xs text-slate-400 whitespace-nowrap">{getRelativeTime(question.created_at)}</span>
              </>
            )}
            {viewCount > 0 && (
              <>
                <span className="mx-1.5 text-slate-300 text-xs select-none">•</span>
                <span className="text-xs text-slate-400 whitespace-nowrap">{viewCount} {viewCount === 1 ? 'view' : 'views'}</span>
              </>
            )}
          </div>
        </div>

        {/* Three-dots menu — always reserve space for structural consistency */}
        <div ref={menuRef} className={`relative shrink-0 ml-3 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${menuOpen ? '!opacity-100' : ''}`}>
          {!isClosed && canModify && !editMode && (
            <>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors duration-150 text-slate-500 hover:text-slate-600 hover:bg-slate-100 ${
                  menuOpen ? 'bg-slate-100 text-slate-600' : ''
                }`}
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden">
                  {question.author_id === currentUserId && (
                    <button
                      onClick={handleEditFromMenu}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-100"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={pencilPath} />
                      </svg>
                      Edit
                    </button>
                  )}
                  <button
                    onClick={handleDeleteFromMenu}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-100"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={trashPath} />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      {editMode ? (
        <div className="space-y-2">
          <textarea
            ref={editRef}
            className={textareaCls}
            rows={1}
            style={{ maxHeight: '40vh' }}
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
              if (e.key === 'Escape') { setEditMode(false); setEditText(question.text) }
            }}
            maxLength={5000}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setEditText(question.text) }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words leading-7 text-slate-800">{question.text}</p>
      )}

      {/* ── FOOTER ── */}
      <div className="mt-4 flex items-center gap-2">
        {confirmDelete ? (
          <InlineConfirm onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
        ) : (
          <>
            {/* Like reaction badge */}
            <button
              onClick={!isClosed ? handleLike : undefined}
              aria-label={question.liked_by_me ? 'Unlike question' : 'Like question'}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-100 select-none ${
                isClosed
                  ? 'border-slate-100 text-slate-300 cursor-default'
                  : question.liked_by_me
                    ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-50 active:scale-105'
                    : 'bg-transparent border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-500 active:scale-105'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" strokeWidth={1.75} />
              {question.likes_count > 0 && <span>{question.likes_count}</span>}
            </button>

            {/* Replies button or "be the first" link */}
            {replyCount === 0 ? (
              <button
                onClick={handleReplyToggle}
                aria-label="Be the first to answer"
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all duration-150"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={chatPath} />
                </svg>
                Be the first to answer
              </button>
            ) : (
              <button
                onClick={handleReplyToggle}
                aria-label={showReplies ? 'Hide replies' : `Show ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  showReplies
                    ? 'bg-blue-50 border border-blue-200 text-blue-600'
                    : 'bg-transparent border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-105'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={chatPath} />
                </svg>
                {replyCount}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── REPLY THREAD ── */}
      {showReplies && (
        <div className="mt-2">
          <ReplyThread
            qnaId={qnaId}
            question={question}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            isClosed={isClosed}
            onAccept={onUpdate}
          />
        </div>
      )}
    </div>
  )
}
