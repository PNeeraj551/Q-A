import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '../../context/AuthContext'
import { getQna } from '../../api/qna'
import { listQuestions, createQuestion } from '../../api/questions'
import { QuestionCard } from '../../components/QuestionCard'
import { useQnaSocket } from '../../hooks/useQnaSocket'
import { Toast } from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

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
  const inputRef = useRef(null)
  const { toast, show: showToast, dismiss } = useToast()

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
        .sort((a, b) => b.likes_count - a.likes_count || new Date(b.created_at) - new Date(a.created_at))
    )
  }, [])

  const handleDelete = useCallback((qId) => {
    setQuestions((prev) => prev.filter((q) => q._id !== qId))
  }, [])

  const onQuestionNew = useCallback((question) => {
    setQuestions((prev) => {
      if (prev.some((q) => q._id === question._id)) return prev
      if (prev.some((q) => q._isOptimistic && q.text === question.text && String(q.author_id) === String(question.author_id))) return prev
      return [...prev, question].sort((a, b) => b.likes_count - a.likes_count || new Date(b.created_at) - new Date(a.created_at))
    })
  }, [])

  const onReplyNew = useCallback(({ question_id }) => {
    setQuestions((prev) =>
      prev.map((q) => String(q._id) === String(question_id) ? { ...q, reply_count: q.reply_count + 1 } : q)
    )
  }, [])

  const socketRef = useQnaSocket(id, { onQuestionNew, onReplyNew })

  async function handleSubmitQuestion(e) {
    e.preventDefault()
    const text = questionText.trim()
    if (!text) return

    const tempId = 'temp_' + Date.now()
    const tempQuestion = {
      _id: tempId,
      qna_id: id,
      text,
      author_id: user?._id || user?.user_id,
      author_name: user?.name,
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
          .sort((a, b) => b.likes_count - a.likes_count || new Date(b.created_at) - new Date(a.created_at))
      )
    } catch {
      setQuestions((prev) => prev.filter((q) => q._id !== tempId))
      setQuestionText(text)
      showToast('Failed to post question. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Q&A">
        <div className="max-w-3xl space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse w-24" />
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
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
      <DashboardLayout title="Q&A" onBack={() => navigate('/admin/qna')}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">Failed to load this Q&A</p>
          <p className="text-sm text-muted-foreground mt-1">It may have been removed or you may not have access.</p>
          <button onClick={() => navigate('/admin/qna')} className="mt-4 text-sm text-primary hover:underline">
            Back to Q&A posts
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const currentUserId = user?._id || user?.user_id

  const questionForm = (
    <form
      onSubmit={handleSubmitQuestion}
      className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-2"
    >
      <input
        ref={inputRef}
        className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder="Post a question..."
        maxLength={1000}
        disabled={submitting}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (questionText.trim() && !submitting) handleSubmitQuestion(e)
          }
        }}
      />
      <button
        type="submit"
        disabled={submitting || !questionText.trim()}
        className="shrink-0 w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        )}
      </button>
    </form>
  )

  return (
    <>
    <DashboardLayout
      title={post.title}
      subtitle={post.description || undefined}
      onBack={() => navigate('/admin/qna')}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={post.visibility === 'PUBLIC' ? 'default' : 'secondary'}>
            {post.visibility === 'PUBLIC' ? 'Public' : 'Private'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/qna/${id}/edit`)}>
            Edit
          </Button>
        </div>
      }
      bottomBar={questionForm}
    >
      <div className="max-w-3xl">
        {questions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No questions posted yet.</div>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <QuestionCard
                key={q._id}
                qnaId={id}
                question={q}
                currentUserId={currentUserId}
                isAdmin={true}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                socketRef={socketRef}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
    {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDismiss={dismiss} />}
    </>
  )
}
