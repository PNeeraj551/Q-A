import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { getQna } from '../../api/qna'
import { listQuestions, createQuestion } from '../../api/questions'
import { QuestionCard } from '../../components/QuestionCard'
import { useQnaSocket } from '../../hooks/useQnaSocket'
import toast from 'react-hot-toast'

function VisibilityBadge({ visibility }) {
  if (visibility === 'PUBLIC') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        Public
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      Private
    </span>
  )
}

function StatusBadge({ isClosed }) {
  if (!isClosed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Open
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      Closed
    </span>
  )
}

export default function QnaFeedPage() {
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
        .map((q) => (q._id === updated._id ? updated : q))
        .sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
    )
  }, [])

  const handleDelete = useCallback((qId) => {
    setQuestions((prev) => prev.filter((q) => q._id !== qId))
  }, [])

  const onQuestionNew = useCallback((question) => {
    setQuestions((prev) => {
      if (prev.some((q) => q._id === question._id)) return prev
      if (prev.some((q) => q._isOptimistic && q.text === question.text && String(q.author_id) === String(question.author_id))) return prev
      return [...prev, question].sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
    })
  }, [])

  const onQuestionUpdate = useCallback((updated) => {
    setQuestions((prev) =>
      prev.map((q) => (q._id === updated._id ? { ...q, ...updated } : q))
    )
  }, [])

  const onQuestionDelete = useCallback(({ question_id }) => {
    setQuestions((prev) => prev.filter((q) => q._id !== question_id))
  }, [])

  const onQuestionLike = useCallback(({ question_id, likes_count }) => {
    setQuestions((prev) =>
      prev
        .map((q) => (q._id === question_id ? { ...q, likes_count } : q))
        .sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
    )
  }, [])

  const onReplyNew = useCallback(({ question_id }) => {
    setQuestions((prev) =>
      prev.map((q) => String(q._id) === String(question_id) ? { ...q, reply_count: q.reply_count + 1 } : q)
    )
  }, [])

  const onReplyDelete = useCallback(({ question_id }) => {
    setQuestions((prev) =>
      prev.map((q) => String(q._id) === String(question_id) ? { ...q, reply_count: Math.max(0, q.reply_count - 1) } : q)
    )
  }, [])

  const onQnaUpdate = useCallback((updatedPost) => {
    setPost(updatedPost)
  }, [])

  const socketRef = useQnaSocket(id, {
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
      _id: tempId,
      qna_id: id,
      text,
      author_id: user._id || user.user_id,
      author_name: user.name,
      likes_count: 0,
      reply_count: 0,
      liked_by_me: false,
      created_at: new Date().toISOString(),
      _isOptimistic: true,
    }

    setQuestions((prev) => [...prev, tempQuestion])
    setQuestionText('')
    setSubmitting(true)

    try {
      const res = await createQuestion(id, text)
      setQuestions((prev) =>
        prev
          .map((q) => (q._id === tempId ? res.data.question : q))
          .sort((a, b) => b.likes_count - a.likes_count || new Date(a.created_at) - new Date(b.created_at))
      )
    } catch {
      setQuestions((prev) => prev.filter((q) => q._id !== tempId))
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
        <div className="max-w-3xl space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded-xl animate-pulse w-24" />
                  <div className="h-4 bg-slate-100 rounded-xl animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    )
  }

  if (fetchError) {
    return (
      <DashboardLayout title="Q&A" onBack={() => navigate('/user/qna')}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-base font-bold text-slate-900">Failed to load this Q&A</p>
          <p className="text-sm text-slate-500 mt-1.5">It may have been removed or you may not have access.</p>
          <button onClick={() => navigate('/user/qna')} className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200">
            Back to boards
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const currentUserId = user?._id || user?.user_id
  const isClosed = post.status === 'CLOSED' || autoClosedByTimer || (post.end_at && new Date() >= new Date(post.end_at))

  const questionForm = isClosed ? (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[13px] text-slate-500">
      <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      This Q&A board is closed. No new questions can be posted.
    </div>
  ) : (
    <form
      onSubmit={handleSubmitQuestion}
      className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm hover:border-slate-300 transition-all duration-200"
    >
      <input
        ref={inputRef}
        className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder="Ask a question..."
        maxLength={1000}
        disabled={submitting}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (questionText.trim() && !submittingRef.current) handleSubmitQuestion(e)
          }
        }}
      />
      <button
        type="submit"
        className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center hover:from-blue-700 hover:to-indigo-700 hover:shadow-md active:scale-95 transition-all duration-200"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      </button>
    </form>
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
      <div className="max-w-3xl">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-base font-bold text-slate-900">No questions yet</p>
            <p className="text-sm text-slate-500 mt-1.5">Be the first to ask a question below.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q._id}>
                <QuestionCard
                  qnaId={id}
                  question={q}
                  currentUserId={currentUserId}
                  isAdmin={user?.role === 'admin'}
                  isClosed={isClosed}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  socketRef={socketRef}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
