import { useRef } from 'react'
import toast from 'react-hot-toast'
import { togglePublicLike } from '../../api/publicQna'
import { VoteBadge } from '../common/VoteBadge'

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

export default function PublicQuestionCard({ question, boardId, isClosed, isNew, onUpdate }) {
  const togglingRef = useRef(false)

  async function handleLike() {
    if (togglingRef.current || isClosed || question._isOptimistic) return
    togglingRef.current = true

    const wasLiked = question.liked_by_me ?? false
    const wasCount = question.likes_count ?? 0

    // Optimistic update through parent — single source of truth
    onUpdate({ ...question, liked_by_me: !wasLiked, likes_count: wasLiked ? wasCount - 1 : wasCount + 1 })

    try {
      const res = await togglePublicLike(boardId, question.id)
      onUpdate({ ...question, likes_count: res.data.likes_count, liked_by_me: res.data.liked_by_me })
    } catch {
      onUpdate({ ...question, liked_by_me: wasLiked, likes_count: wasCount })
      toast.error('Failed to update like')
    } finally {
      togglingRef.current = false
    }
  }

  const answered = !!question.answered_in_slack
  const letter = (question.author_name || '?')[0].toUpperCase()
  const avatarColor = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <div className={`px-6 py-4 transition-opacity duration-150${answered ? ' opacity-70' : ''}${isNew ? ' animate-[fadeSlideIn_200ms_ease_out]' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 mt-0.5 ${avatarColor}`}>
          {letter}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          {/* Name + time + badges */}
          <div className="flex items-center gap-0 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-slate-700 leading-snug">
              {question.author_name || 'Anonymous'}
            </span>
            <span className="mx-1.5 text-slate-300 text-xs select-none">·</span>
            <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(question.created_at)}</span>
            {question._isOptimistic && (
              <span className="ml-1.5 text-xs text-slate-400 italic">Posting…</span>
            )}
            {answered && (
              <span className="ml-2 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs px-2 py-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Answered in Slack
              </span>
            )}
          </div>

          {/* Question text */}
          <p className="text-[15px] text-slate-800 leading-relaxed break-words">{question.text}</p>
        </div>

        {/* Vote badge */}
        <div className="shrink-0 mt-0.5">
          <VoteBadge
            count={question.likes_count ?? 0}
            voted={question.liked_by_me ?? false}
            disabled={isClosed || !!question._isOptimistic}
            onClick={handleLike}
          />
        </div>
      </div>
    </div>
  )
}
