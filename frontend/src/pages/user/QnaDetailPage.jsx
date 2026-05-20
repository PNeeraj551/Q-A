import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getQna } from '../../api/qna'
import { listQuestions, createQuestion } from '../../api/questions'
import { QuestionCard } from '@/components/qna/QuestionCard'
import { useQnaRealtime } from '../../hooks/useQnaRealtime'
import toast from 'react-hot-toast'
import { VisibilityBadge, StatusBadge } from '@/components/common/Badges'
import { EmptyState } from '@/components/common/EmptyState'
import { PageError } from '@/components/common/PageError'
import { Skeleton } from '@/components/common/Skeleton'
import { SendButton } from '@/components/common/SendButton'
import { Surface } from '@/components/common/Surface'
import { Stack } from '@/components/common/Stack'

export default function QnaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [post, setPost] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const inputRef = useRef(null)
  const bottomRef = useRef(null)
  const [autoClosedByTimer, setAutoClosedByTimer] = useState(false)

  useEffect(() => {
    if (!post?.end_at || post?.status === 'CLOSED') return
    const remaining = new Date(post.end_at) - Date.now()
    if (remaining <= 0) { setAutoClosedByTimer(true); return }
    const timer = setTimeout(() => setAutoClosedByTimer(true), remaining)
    return () => clearTimeout(timer)
  }, [post?.end_at, post?.status])

  useEffect(() => {
    Promise.all([getQna(id), listQuestions(id)])
      .then(([postRes, qRes]) => {
        setPost(postRes.data.post)
        setQuestions(qRes.data.questions || [])
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleUpdate = useCallback((updated) => {
    setQuestions((prev) =>
      prev
        .map((q) => (q.id === updated.id ? updated : q))
        .sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
    )
  }, [])

  const handleDelete = useCallback((qId) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId))
  }, [])

  const onQuestionNew = useCallback((question) => {
    setQuestions((prev) => {
      if (prev.some((q) => q.id === question.id)) return prev
      if (prev.some((q) => q._isOptimistic && q.text === question.text && String(q.author_id) === String(question.author_id))) return prev
      return [...prev, question].sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
    })
  }, [])

  const onQuestionUpdate = useCallback((updated) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q))
    )
  }, [])

  const onQuestionDelete = useCallback(({ question_id }) => {
    setQuestions((prev) => prev.filter((q) => q.id !== question_id))
  }, [])

  const onQuestionLike = useCallback(({ question_id, likes_count }) => {
    setQuestions((prev) =>
      prev
        .map((q) => (q.id === question_id ? { ...q, likes_count } : q))
        .sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
    )
  }, [])

  const onReplyNew = useCallback(({ question_id }) => {
    setQuestions((prev) =>
      prev.map((q) => String(q.id) === String(question_id) ? { ...q, reply_count: q.reply_count + 1 } : q)
    )
  }, [])

  const onReplyDelete = useCallback(({ question_id }) => {
    setQuestions((prev) =>
      prev.map((q) => String(q.id) === String(question_id) ? { ...q, reply_count: Math.max(0, q.reply_count - 1) } : q)
    )
  }, [])

  const onQnaUpdate = useCallback((updatedPost) => {
    setPost(updatedPost)
  }, [])

  useQnaRealtime(id, {
    onQuestionNew,
    onQuestionUpdate,
    onQuestionDelete,
    onQuestionLike,
    onReplyNew,
    onReplyDelete,
    onQnaUpdate,
  })

  async function handleSubmitQuestion(e) {
    e.preventDefault()
    const text = questionText.trim()
    if (!text || submittingRef.current) return
    submittingRef.current = true

    const tempId = 'temp_' + Date.now()
    const tempQuestion = {
      id: tempId,
      qna_id: id,
      text,
      author_id: user.id || user.user_id,
      author_name: user.name,
      likes_count: 0,
      reply_count: 0,
      liked_by_me: false,
      created_at: new Date().toISOString(),
      _isOptimistic: true,
    }

    setQuestions((prev) => [...prev, tempQuestion])
    setQuestionText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
    setSubmitting(true)

    try {
      const res = await createQuestion(id, text)
      setQuestions((prev) =>
        prev
          .map((q) => (q.id === tempId ? res.data.question : q))
          .sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
      )
    } catch {
      setQuestions((prev) => prev.filter((q) => q.id !== tempId))
      setQuestionText(text)
      toast.error('Failed to post question. Please try again.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Q&A">
        <Stack gap={3} >
          {[...Array(4)].map((_, i) => (
            <Surface key={i} className="p-5">
              <Stack gap={3}>
                <div className="flex gap-3">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <Stack gap={2} className="flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-3/4" />
                  </Stack>
                </div>
              </Stack>
            </Surface>
          ))}
        </Stack>
      </DashboardLayout>
    )
  }

  if (fetchError) {
    return (
      <DashboardLayout title="Q&A" onBack={() => navigate('/user/qna')}>
        <PageError
          heading="Failed to load this Q&A board"
          description="It may have been removed or you may not have access."
          action={{ label: 'Back to Q&A Boards', onClick: () => navigate('/user/qna') }}
        />
      </DashboardLayout>
    )
  }

  const currentUserId = user?.id || user?.user_id
  const isClosed = post.status === 'CLOSED' || autoClosedByTimer || (post.end_at && new Date() >= new Date(post.end_at))

  const questionForm = isClosed ? (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-500">
      <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      This Q&A board is closed. No new questions can be posted.
    </div>
  ) : (
    <div>
      <form
        onSubmit={handleSubmitQuestion}
        className="composer-shell"
      >
        <textarea
          ref={inputRef}
          rows={1}
          className="composer-input"
          style={{ maxHeight: '40vh' }}
          value={questionText}
          onChange={(e) => {
            setQuestionText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          placeholder="Ask a question..."
          maxLength={5000}
          disabled={submitting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (questionText.trim() && !submittingRef.current) handleSubmitQuestion(e)
            }
          }}
        />
        <button type="submit" disabled={submitting} aria-label="Post question" className="composer-send">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
      <p className="mt-1.5 pr-1 text-right text-xs text-slate-400">
        Enter to post · Shift+Enter for new line
      </p>
    </div>
  )

  return (
    <DashboardLayout
      title={post.title}
      subtitle={post.description || undefined}
      onBack={() => navigate('/user/qna')}
      actions={
        <div className="flex items-center gap-2">
          <VisibilityBadge visibility={post.visibility} />
          <StatusBadge isClosed={isClosed} />
        </div>
      }
      bottomBar={questionForm}
    >
      {questions.length === 0 ? (
        <EmptyState
          heading="No questions yet"
          description="Be the first to ask a question below."
        />
      ) : (
        <Stack gap={4} >
          {questions.map((q) => (
            <div key={q.id}>
              <QuestionCard
                qnaId={id}
                question={q}
                currentUserId={currentUserId}
                isAdmin={user?.role === 'admin'}
                isClosed={isClosed}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </Stack>
      )}
      <div ref={bottomRef} />
    </DashboardLayout>
  )
}
