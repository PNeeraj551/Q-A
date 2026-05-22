import { useEffect, useRef, useState } from 'react'
import { ThumbsUp, Send, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  togglePublicLike,
  togglePublicReplyLike,
  getPublicReplies,
  postPublicReply,
  trackPublicView,
} from '../../api/publicQna'

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Avatar({ name, size = 'sm' }) {
  const letter = (name || '?')[0].toUpperCase()
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center shrink-0`}>
      {letter}
    </div>
  )
}

function LikeButton({ liked, count, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-100 select-none',
        disabled
          ? 'border-slate-100 text-slate-300 cursor-default'
          : liked
          ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-50 active:scale-105'
          : 'bg-transparent border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-500 active:scale-105',
      ].join(' ')}
    >
      <ThumbsUp className="w-3.5 h-3.5" strokeWidth={2} />
      <span>{count}</span>
    </button>
  )
}

function ReplyItem({ reply, boardId, qId, isClosed }) {
  const [liked, setLiked] = useState(reply.liked_by_me ?? false)
  const [likeCount, setLikeCount] = useState(reply.likes_count ?? 0)
  const togglingRef = useRef(false)

  async function handleLike() {
    if (togglingRef.current || isClosed) return
    togglingRef.current = true
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))
    try {
      await togglePublicReplyLike(boardId, qId, reply.id)
    } catch {
      setLiked(wasLiked)
      setLikeCount((c) => c + (wasLiked ? 1 : -1))
      toast.error('Failed to update like')
    } finally {
      togglingRef.current = false
    }
  }

  return (
    <div className="group flex gap-2.5 py-3">
      <Avatar name={reply.author_name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-slate-700">{reply.author_name || 'Anonymous'}</span>
          <span className="text-xs text-slate-400">{timeAgo(reply.created_at)}</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed break-words">{reply.text}</p>
        <div className="mt-1.5">
          <LikeButton liked={liked} count={likeCount} disabled={isClosed} onClick={handleLike} />
        </div>
      </div>
    </div>
  )
}

export default function PublicQuestionCard({ question, boardId, isClosed, session, onUpdate }) {
  const [liked, setLiked] = useState(question.liked_by_me ?? false)
  const [likeCount, setLikeCount] = useState(question.likes_count ?? 0)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [replies, setReplies] = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const togglingRef = useRef(false)
  const viewedRef = useRef(false)

  useEffect(() => {
    if (!question._isOptimistic && !viewedRef.current) {
      viewedRef.current = true
      trackPublicView(boardId, question.id).catch(() => {})
    }
  }, [boardId, question.id, question._isOptimistic])

  async function handleLike() {
    if (togglingRef.current || isClosed || question._isOptimistic) return
    togglingRef.current = true
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))
    try {
      const res = await togglePublicLike(boardId, question.id)
      const updated = res.data.question
      onUpdate({ ...question, likes_count: updated.likes_count, liked_by_me: !wasLiked })
    } catch {
      setLiked(wasLiked)
      setLikeCount((c) => c + (wasLiked ? 1 : -1))
      toast.error('Failed to update like')
    } finally {
      togglingRef.current = false
    }
  }

  async function handleToggleReplies() {
    if (question._isOptimistic) return
    const opening = !repliesOpen
    setRepliesOpen(opening)
    if (opening && !repliesLoaded) {
      setRepliesLoading(true)
      try {
        const res = await getPublicReplies(boardId, question.id)
        setReplies(res.data.replies || [])
        setRepliesLoaded(true)
      } catch {
        toast.error('Failed to load replies')
        setRepliesOpen(false)
      } finally {
        setRepliesLoading(false)
      }
    }
  }

  async function handleSubmitReply(e) {
    e.preventDefault()
    const text = replyText.trim()
    if (!text || submitting) return
    setSubmitting(true)

    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      text,
      author_name: session.is_anonymous ? 'Anonymous' : session.display_name,
      likes_count: 0,
      liked_by_me: false,
      created_at: new Date().toISOString(),
      _isOptimistic: true,
    }
    setReplies((prev) => [...prev, optimistic])
    setReplyText('')

    try {
      const res = await postPublicReply(boardId, question.id, text)
      const saved = res.data.reply
      setReplies((prev) => prev.map((r) => r.id === tempId ? { ...saved, liked_by_me: false } : r))
      onUpdate({ ...question, reply_count: (question.reply_count ?? 0) + 1 })
    } catch (err) {
      setReplies((prev) => prev.filter((r) => r.id !== tempId))
      setReplyText(text)
      toast.error(err.response?.data?.error || 'Failed to post reply')
    } finally {
      setSubmitting(false)
    }
  }

  const replyCount = question.reply_count ?? 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Question body */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Avatar name={question.author_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-slate-700">
                {question.author_name || 'Anonymous'}
              </span>
              <span className="text-xs text-slate-400">{timeAgo(question.created_at)}</span>
              {question._isOptimistic && (
                <span className="text-xs text-slate-400 italic">Posting…</span>
              )}
            </div>
            <p className="text-sm text-slate-800 leading-relaxed break-words">{question.text}</p>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <LikeButton
            liked={liked}
            count={likeCount}
            disabled={isClosed || !!question._isOptimistic}
            onClick={handleLike}
          />
          <button
            type="button"
            onClick={handleToggleReplies}
            disabled={!!question._isOptimistic}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border border-slate-200 bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-500 transition-colors duration-100 select-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-3.5 h-3.5" strokeWidth={2} />
            <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
            {repliesOpen
              ? <ChevronUp className="w-3 h-3" strokeWidth={2} />
              : <ChevronDown className="w-3 h-3" strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Reply thread */}
      {repliesOpen && (
        <div className="border-t border-slate-100 bg-slate-50 px-5">
          {repliesLoading ? (
            <div className="py-4 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-indigo-400 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {replies.length === 0 && (
                <p className="py-4 text-xs text-slate-400 text-center">No replies yet.</p>
              )}
              {replies.map((r) => (
                <ReplyItem
                  key={r.id}
                  reply={r}
                  boardId={boardId}
                  qId={question.id}
                  isClosed={isClosed}
                />
              ))}
            </div>
          )}

          {/* Reply input */}
          {!isClosed && (
            <form onSubmit={handleSubmitReply} className="flex items-center gap-2 py-3">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your comments here..."
                maxLength={2000}
                className="flex-1 rounded-full px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-150"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || submitting}
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-150 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5 text-white" strokeWidth={2} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
