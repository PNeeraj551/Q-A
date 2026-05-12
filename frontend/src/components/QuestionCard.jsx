import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { textareaCls } from '@/lib/ui'
import { getRelativeTime } from '@/lib/utils'
import { listReplies, createReply, updateReply, deleteReply } from '../api/replies'
import { updateQuestion, deleteQuestion, toggleLike } from '../api/questions'

// ───────────────────────── REPLY THREAD ─────────────────────────
export function ReplyThread({ qnaId, question, currentUserId, isAdmin, isClosed, socketRef }) {
  const [replies, setReplies] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const submittingRef = useRef(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const deletingRepliesRef = useRef(new Set())
  const savingRepliesRef = useRef(new Set())

  useEffect(() => {
    listReplies(qnaId, question._id)
      .then((res) => setReplies(res.data.replies || []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [qnaId, question._id])

  useEffect(() => {
    if (!socketRef) return
    function onReplyNew({ reply, question_id }) {
      if (String(question_id) !== String(question._id)) return
      setReplies((prev) => {
        if (prev.some((r) => r._id === reply._id)) return prev
        const optIdx = prev.findIndex((r) => r._isOptimistic && String(r.author_id) === String(reply.author_id) && r.text === reply.text)
        if (optIdx !== -1) { const next = [...prev]; next[optIdx] = reply; return next }
        return [...prev, reply]
      })
    }
    const socket = socketRef.current
    if (socket) {
      socket.on('reply:new', onReplyNew)
      return () => socket.off('reply:new', onReplyNew)
    }
  }, [socketRef, question._id])

  async function handleSubmitReply(e) {
    e.preventDefault()
    const text = replyText.trim()
    if (!text || submittingRef.current) return
    submittingRef.current = true
    const tempId = 'temp_' + Date.now()
    setReplies((prev) => [...prev, {
      _id: tempId, text, author_id: currentUserId,
      author_name: 'You', created_at: new Date().toISOString(), _isOptimistic: true,
    }])
    setReplyText('')
    try {
      const res = await createReply(qnaId, question._id, text)
      setReplies((prev) => prev.map((r) => (r._id === tempId ? res.data.reply : r)))
    } catch {
      setReplies((prev) => prev.filter((r) => r._id !== tempId))
      setReplyText(text)
    } finally {
      submittingRef.current = false
    }
  }

  async function handleDeleteReply(rId) {
    if (deletingRepliesRef.current.has(rId)) return
    deletingRepliesRef.current.add(rId)
    const backup = replies.find((r) => r._id === rId)
    setReplies((prev) => prev.filter((r) => r._id !== rId))
    try {
      await deleteReply(qnaId, question._id, rId)
    } catch {
      if (backup) setReplies((prev) => [...prev, backup].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
    } finally {
      deletingRepliesRef.current.delete(rId)
    }
  }

  async function handleSaveEdit(rId) {
    const text = editText.trim()
    if (!text || savingRepliesRef.current.has(rId)) return
    savingRepliesRef.current.add(rId)
    const original = replies.find((r) => r._id === rId)
    setReplies((prev) => prev.map((r) => (r._id === rId ? { ...r, text } : r)))
    setEditingId(null)
    try {
      const res = await updateReply(qnaId, question._id, rId, text)
      setReplies((prev) => prev.map((r) => (r._id === rId ? res.data.reply : r)))
    } catch {
      if (original) setReplies((prev) => prev.map((r) => (r._id === rId ? original : r)))
    } finally {
      savingRepliesRef.current.delete(rId)
    }
  }

  if (!loaded) return <p className="text-xs text-slate-400 pt-3">Loading replies...</p>

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      {replies.length === 0 && (
        <p className="text-xs text-slate-400 pl-1">No replies yet.</p>
      )}

      {/* Threaded replies with visual left border */}
      {replies.length > 0 && (
        <div className="border-l-2 border-slate-100 ml-1 pl-4 space-y-3">
          {replies.map((r) => (
            <div key={r._id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0 mt-0.5">
                {r.author_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900">
                  {r.author_name}
                  {r.created_at && (
                    <span className="ml-2 font-normal text-slate-400">{getRelativeTime(r.created_at)}</span>
                  )}
                </p>
                {editingId === r._id ? (
                  <div className="mt-1.5 space-y-2">
                    <textarea
                      className={textareaCls}
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={1000}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(r._id)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{r.text}</p>
                )}
              </div>
              {!isClosed && (r.author_id === currentUserId || isAdmin) && editingId !== r._id && (
                <div className="flex gap-2 shrink-0">
                  {r.author_id === currentUserId && (
                    <button
                      className="text-xs text-slate-400 hover:text-slate-700 transition-colors duration-200"
                      onClick={() => { setEditingId(r._id); setEditText(r.text) }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors duration-200"
                    onClick={() => handleDeleteReply(r._id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isClosed && (
        <form onSubmit={handleSubmitReply} className="flex gap-2 pt-1 ml-1">
          <input
            className="flex-1 h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 transition-all duration-200"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            maxLength={1000}
          />
          <Button type="submit" size="sm">
            Reply
          </Button>
        </form>
      )}
    </div>
  )
}

// ───────────────────────── QUESTION CARD ─────────────────────────
export function QuestionCard({ qnaId, question, currentUserId, isAdmin, isClosed, onUpdate, onDelete, socketRef }) {
  const [showReplies, setShowReplies] = useState(false)
  const likingRef = useRef(false)
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState(question.text)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleLike() {
    if (likingRef.current) return
    likingRef.current = true
    try {
      const res = await toggleLike(qnaId, question._id)
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
      const res = await updateQuestion(qnaId, question._id, text)
      onUpdate(res.data.question)
    } catch {
      onUpdate({ ...question, text: original })
    } finally {
      savingRef.current = false
    }
  }

  async function handleDelete() {
    if (deletingRef.current) return
    deletingRef.current = true
    onDelete(question._id)
    try {
      await deleteQuestion(qnaId, question._id)
    } catch { /* already removed optimistically */ }
  }

  const canModify = question.author_id === currentUserId || isAdmin
  const replyLabel =
    question.reply_count === 0 ? 'Reply' :
    question.reply_count === 1 ? '1 reply' :
    `${question.reply_count} replies`

  const initial = question.author_name?.[0]?.toUpperCase() || '?'
  const avatarColor =
    initial >= 'A' && initial <= 'G' ? 'bg-violet-100 text-violet-700' :
    initial >= 'H' && initial <= 'N' ? 'bg-blue-100 text-blue-700' :
    'bg-emerald-100 text-emerald-700'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${avatarColor}`}>
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 mb-0.5">
            {question.author_name}
            {question.created_at && (
              <span className="ml-2 font-normal text-slate-400 text-xs">{getRelativeTime(question.created_at)}</span>
            )}
          </p>

          {editMode ? (
            <div className="space-y-2 mt-2">
              <textarea
                className={textareaCls}
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={1000}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setEditText(question.text) }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-800 leading-relaxed mt-1">{question.text}</p>
          )}

          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={!isClosed ? handleLike : undefined}
              className={`flex items-center gap-1.5 text-sm transition-all duration-200 ${
                isClosed
                  ? 'text-slate-400 cursor-default'
                  : `active:scale-95 ${question.liked_by_me ? 'text-blue-600 font-medium' : 'text-slate-400 hover:text-slate-700'}`
              }`}
            >
              <svg
                className="w-4 h-4"
                fill={question.liked_by_me ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              {question.likes_count}
            </button>

            <button
              onClick={() => setShowReplies(v => !v)}
              className="text-sm text-slate-400 hover:text-slate-700 transition-colors duration-200"
            >
              {showReplies ? 'Hide replies' : replyLabel}
            </button>

            {!isClosed && canModify && !editMode && (
              <div className="flex items-center gap-3 ml-auto">
                {question.author_id === currentUserId && (
                  <button
                    onClick={() => { setEditMode(true); setEditText(question.text) }}
                    className="text-xs text-slate-400 hover:text-slate-700 transition-colors duration-200"
                  >
                    Edit
                  </button>
                )}
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors duration-200"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      className="text-xs text-red-600 font-medium hover:text-red-700 transition-colors duration-200"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-slate-400 hover:text-slate-700 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showReplies && (
        <div className="ml-12">
          <ReplyThread
            qnaId={qnaId}
            question={question}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            isClosed={isClosed}
            socketRef={socketRef}
          />
        </div>
      )}
    </div>
  )
}
