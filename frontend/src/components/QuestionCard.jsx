import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { inputCls, textareaCls } from '@/lib/ui'
import { listReplies, createReply, updateReply, deleteReply } from '../api/replies'
import { updateQuestion, deleteQuestion, toggleLike } from '../api/questions'

// ───────────────────────── REPLY THREAD ─────────────────────────
export function ReplyThread({ qnaId, question, currentUserId, isAdmin, socketRef }) {
  const [replies, setReplies] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [deletingId, setDeletingId] = useState(null)

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
    if (!text) return
    const tempId = 'temp_' + Date.now()
    setReplies((prev) => [...prev, {
      _id: tempId, text, author_id: currentUserId,
      author_name: 'You', created_at: new Date().toISOString(), _isOptimistic: true,
    }])
    setReplyText('')
    setSubmitting(true)
    try {
      const res = await createReply(qnaId, question._id, text)
      setReplies((prev) => prev.map((r) => (r._id === tempId ? res.data.reply : r)))
    } catch {
      setReplies((prev) => prev.filter((r) => r._id !== tempId))
      setReplyText(text)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteReply(rId) {
    setDeletingId(rId)
    const backup = replies.find((r) => r._id === rId)
    setReplies((prev) => prev.filter((r) => r._id !== rId))
    try {
      await deleteReply(qnaId, question._id, rId)
    } catch {
      if (backup) setReplies((prev) => [...prev, backup].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveEdit(rId) {
    const text = editText.trim()
    if (!text) return
    const original = replies.find((r) => r._id === rId)
    setReplies((prev) => prev.map((r) => (r._id === rId ? { ...r, text } : r)))
    setEditingId(null)
    try {
      const res = await updateReply(qnaId, question._id, rId, text)
      setReplies((prev) => prev.map((r) => (r._id === rId ? res.data.reply : r)))
    } catch {
      if (original) setReplies((prev) => prev.map((r) => (r._id === rId ? original : r)))
    }
  }

  if (!loaded) return <p className="text-xs text-muted-foreground pt-3">Loading replies...</p>

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {replies.length === 0 && (
        <p className="text-xs text-muted-foreground">No replies yet.</p>
      )}

      {replies.map((r) => (
        <div key={r._id} className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">
            {r.author_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{r.author_name}</p>
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
              <p className="text-sm text-foreground/80 mt-0.5 leading-relaxed">{r.text}</p>
            )}
          </div>
          {(r.author_id === currentUserId || isAdmin) && editingId !== r._id && (
            <div className="flex gap-2 shrink-0">
              {r.author_id === currentUserId && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setEditingId(r._id); setEditText(r.text) }}
                >
                  Edit
                </button>
              )}
              <button
                className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                disabled={deletingId === r._id}
                onClick={() => handleDeleteReply(r._id)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}

      <form onSubmit={handleSubmitReply} className="flex gap-2 pt-1">
        <input
          className={`${inputCls} flex-1`}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write a reply..."
          maxLength={1000}
          disabled={submitting}
        />
        <Button type="submit" size="sm" disabled={submitting || !replyText.trim()}>
          Reply
        </Button>
      </form>
    </div>
  )
}

// ───────────────────────── QUESTION CARD ─────────────────────────
export function QuestionCard({ qnaId, question, currentUserId, isAdmin, onUpdate, onDelete, socketRef }) {
  const [showReplies, setShowReplies] = useState(false)
  const [liking, setLiking] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState(question.text)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleLike() {
    if (liking) return
    setLiking(true)
    const optimisticLiked = !question.liked_by_me
    const optimisticCount = question.likes_count + (optimisticLiked ? 1 : -1)
    onUpdate({ ...question, liked_by_me: optimisticLiked, likes_count: optimisticCount })
    try {
      const res = await toggleLike(qnaId, question._id)
      onUpdate({ ...question, liked_by_me: res.data.liked_by_me, likes_count: res.data.likes_count })
    } catch {
      onUpdate(question)
    } finally {
      setLiking(false)
    }
  }

  async function handleSaveEdit() {
    const text = editText.trim()
    if (!text || text === question.text) { setEditMode(false); return }
    const original = question.text
    onUpdate({ ...question, text })
    setEditMode(false)
    try {
      const res = await updateQuestion(qnaId, question._id, text)
      onUpdate(res.data.question)
    } catch {
      onUpdate({ ...question, text: original })
    }
  }

  async function handleDelete() {
    setDeleting(true)
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

  return (
    <div className="bg-card border border-border rounded-xl p-5 transition-colors hover:border-border/70">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {question.author_name?.[0]?.toUpperCase() || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{question.author_name}</p>

          {editMode ? (
            <div className="space-y-2">
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
            <p className="text-sm text-foreground leading-relaxed">{question.text}</p>
          )}

          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={handleLike}
              disabled={liking}
              className={`flex items-center gap-1.5 text-sm transition-colors disabled:cursor-not-allowed ${
                question.liked_by_me
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
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
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showReplies ? 'Hide replies' : replyLabel}
            </button>

            {canModify && !editMode && (
              <div className="flex items-center gap-3 ml-auto">
                {question.author_id === currentUserId && (
                  <button
                    onClick={() => { setEditMode(true); setEditText(question.text) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Edit
                  </button>
                )}
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs text-destructive font-medium hover:text-destructive/80 transition-colors disabled:opacity-40"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="ml-11">
          <ReplyThread
            qnaId={qnaId}
            question={question}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            socketRef={socketRef}
          />
        </div>
      )}
    </div>
  )
}
