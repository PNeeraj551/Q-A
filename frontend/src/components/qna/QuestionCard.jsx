import { useEffect, useRef, useState } from 'react'
import supabase from '../../utils/supabase'
import { Button } from '@/components/common/Button'
import { Skeleton } from '@/components/common/Skeleton'
import { textareaCls } from '@/utils/ui'
import { getRelativeTime } from '@/utils/utils'
import { listReplies, createReply, updateReply, deleteReply } from '../../api/replies'
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
  const deletingRepliesRef = useRef(new Set())
  const savingRepliesRef = useRef(new Set())
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
        <div className="ml-1 space-y-3">
          {sorted.map((r) => {
            const isAccepted = acceptedId && String(r.id) === acceptedId
            return (
              <div
                key={r.id}
                className={`flex items-start gap-2.5 group rounded-xl p-2 -mx-2 transition-colors duration-150 ${
                  isAccepted ? 'border border-emerald-200 bg-emerald-50/50 rounded-xl p-3 -mx-2' : ''
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
                </div>
                {editingId !== r.id && (
                  <div className="action-buttons flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {canAccept && !r._isOptimistic && (
                      <button
                        onClick={() => handleToggleAccept(r.id)}
                        className={`text-xs font-medium transition-colors duration-150 ${
                          isAccepted
                            ? 'text-emerald-600 hover:text-slate-500'
                            : 'text-slate-400 hover:text-emerald-600'
                        }`}
                        title={isAccepted ? 'Remove accepted solution' : 'Mark as accepted solution'}
                      >
                        {isAccepted ? 'Unaccept' : 'Accept'}
                      </button>
                    )}
                    {!isClosed && (r.author_id === currentUserId || isAdmin) && (
                      <>
                        {r.author_id === currentUserId && (
                          <button
                            className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors duration-150"
                            onClick={() => { setEditingId(r.id); setEditText(r.text) }}
                            title="Edit reply"
                            aria-label="Edit reply"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors duration-150"
                          onClick={() => handleDeleteReply(r.id)}
                          title="Delete reply"
                          aria-label="Delete reply"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isClosed && (
        <form onSubmit={handleSubmitReply} className="flex gap-2 pt-1 ml-1">
          <input
            className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 disabled:opacity-50 transition-all duration-200"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            maxLength={5000}
          />
          <Button type="submit" size="sm">Reply</Button>
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
    try {
      const res = await toggleLike(qnaId, question.id)
      onUpdate({ ...question, liked_by_me: res.data.liked_by_me, likes_count: res.data.likes_count })
    } catch {
      // state unchanged — no optimistic update to roll back
    } finally {
      likingRef.current = false
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
  const thumbUpPath = 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z'
  const chatPath = 'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z'

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm transition-all duration-200 group">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${avatarColor}`}>
            {initial}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-slate-900">{question.author_name}</span>
            {question.created_at && (
              <span className="ml-2 text-xs text-slate-400">
                {getRelativeTime(question.created_at)}
                {viewCount > 0 && <> · {viewCount} {viewCount === 1 ? 'view' : 'views'}</>}
              </span>
            )}
          </div>
        </div>

        {/* Three-dots menu */}
        {!isClosed && canModify && !editMode && (
          <div ref={menuRef} className="relative shrink-0 ml-3">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={`action-buttons p-1.5 rounded-lg transition-colors duration-150 text-slate-400 hover:text-slate-600 hover:bg-slate-100 ${
                menuOpen ? 'opacity-100 bg-slate-100 text-slate-600' : 'opacity-0 group-hover:opacity-100'
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
          </div>
        )}
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
            {/* Like pill */}
            <button
              onClick={!isClosed ? handleLike : undefined}
              aria-label={question.liked_by_me ? 'Unlike question' : 'Like question'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                isClosed
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                  : question.liked_by_me
                    ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 active:scale-95'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-700 active:scale-95'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill={question.liked_by_me ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={thumbUpPath} />
              </svg>
              {question.likes_count > 0 && <span>{question.likes_count}</span>}
            </button>

            {/* Replies pill or "be the first" link */}
            {replyCount === 0 ? (
              <button
                onClick={handleReplyToggle}
                aria-label="Be the first to answer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors duration-150"
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                  showReplies
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 active:scale-95'
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
