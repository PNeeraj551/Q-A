import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getBoardPreview, requestJoinOtp, verifyJoinOtp } from '../../api/userAccess'
import { setPublicBoardId, getPublicQuestions, postPublicQuestion } from '../../api/publicQna'
import { getSession } from '../../hooks/useUserSession'
import PublicQuestionCard from '../../components/public/PublicQuestionCard'
import { useQnaRealtime } from '../../hooks/useQnaRealtime'

// ─── Skeleton ────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="px-5 py-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3 bg-slate-200 rounded w-24" />
            <div className="h-3 bg-slate-100 rounded w-12" />
          </div>
          <div className="h-3.5 bg-slate-100 rounded w-3/4" />
          <div className="h-3.5 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

// ─── Board view ───────────────────────────────────────────────────────────────
function BoardView({ board, session, boardId }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [questionText, setQuestionText] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(session.is_anonymous ?? true)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [localDisplayName, setLocalDisplayName] = useState(session.display_name || '')
  const [nameInput, setNameInput] = useState('')
  const [boardStatus, setBoardStatus] = useState(board.status)
  const [newQuestionCount, setNewQuestionCount] = useState(0)

  const submittingRef = useRef(false)
  const composerRef = useRef(null)
  const listBottomRef = useRef(null)
  const listTopRef = useRef(null)
  const isScrolledPastRef = useRef(false)

  const isClosed = boardStatus === 'CLOSED' || (board.end_at && new Date() >= new Date(board.end_at))

  useEffect(() => {
    getPublicQuestions(boardId)
      .then((res) => {
        const qs = res.data.questions || []
        setQuestions(qs)
      })
      .catch(() => toast.error('Failed to load questions'))
      .finally(() => setLoading(false))
  }, [boardId])

  useQnaRealtime(boardId, {
    onQuestionNew: (q) => {
      setQuestions((prev) => {
        if (prev.some((e) => e.id === q.id)) return prev
        return [...prev, { ...q, liked_by_me: false, _isNew: true }]
      })
      if (isScrolledPastRef.current) setNewQuestionCount((c) => c + 1)
    },
    onQuestionUpdate: (updated) => {
      setQuestions((prev) =>
        prev.map((q) => q.id === updated.id ? { ...q, ...updated, liked_by_me: q.liked_by_me } : q)
      )
    },
    onQuestionDelete: ({ question_id }) => {
      setQuestions((prev) => prev.filter((q) => q.id !== question_id))
    },
    onQuestionLike: ({ question_id, likes_count }) => {
      setQuestions((prev) =>
        prev.map((q) => q.id === question_id ? { ...q, likes_count } : q)
      )
    },
    onQnaUpdate: (payload) => {
      if (payload.status) setBoardStatus(payload.status)
    },
  })

  useEffect(() => {
    if (loading || !listTopRef.current) return
    const el = listTopRef.current
    const observer = new IntersectionObserver(
      ([entry]) => { isScrolledPastRef.current = !entry.isIntersecting },
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading])

  async function handleSubmitQuestion(e) {
    e.preventDefault()
    const text = questionText.trim()
    if (!text || submittingRef.current) return
    submittingRef.current = true

    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      text,
      author_name: isAnonymous ? 'Anonymous' : localDisplayName,
      likes_count: 0,
      liked_by_me: false,
      _isOptimistic: true,
      created_at: new Date().toISOString(),
    }
    setQuestions((prev) => [...prev, optimistic])
    setQuestionText('')
    if (composerRef.current) composerRef.current.style.height = 'auto'

    try {
      const displayName = isAnonymous ? null : localDisplayName
      const res = await postPublicQuestion(boardId, text, isAnonymous, displayName)
      setQuestions((prev) => {
        const alreadyExists = prev.some((q) => q.id === res.data.question.id)
        if (alreadyExists) return prev.filter((q) => q.id !== tempId)
        return prev.map((q) => q.id === tempId ? { ...res.data.question, liked_by_me: false } : q)
      })
    } catch (err) {
      setQuestions((prev) => prev.filter((q) => q.id !== tempId))
      setQuestionText(text)
      toast.error(err.response?.data?.error || 'Failed to post question')
    } finally {
      submittingRef.current = false
    }
  }

  function handleQuestionUpdate(updated) {
    setQuestions((prev) => prev.map((q) => q.id === updated.id ? updated : q))
  }

  function handleQuestionDelete(id) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  function handleScrollToNew() {
    listBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setNewQuestionCount(0)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Board header ── */}
      <div className="shrink-0 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">{board.title}</h1>
            {board.description && (
              <p className="text-sm text-slate-500 mt-0.5 leading-snug">{board.description}</p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              Participating as{' '}
              <span className="font-semibold text-slate-600">{isAnonymous ? 'Anonymous' : localDisplayName}</span>
            </p>
          </div>
          {!isClosed ? (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mt-0.5">
              Closed
            </span>
          )}
        </div>
      </div>

      {/* ── Questions feed ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div ref={listTopRef} />

          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <CardSkeleton />
                </div>
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No questions yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Be the first to ask something below.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {questions.map((q) => (
                <div key={q.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <PublicQuestionCard
                    question={q}
                    boardId={boardId}
                    isClosed={isClosed}
                    session={session}
                    isNew={!!q._isNew}
                    onUpdate={handleQuestionUpdate}
                    onDelete={handleQuestionDelete}
                  />
                </div>
              ))}
            </div>
          )}

          <div ref={listBottomRef} />
        </div>
      </div>

      {/* ── Composer / closed bar ── */}
      {!isClosed ? (
        <div className="shrink-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <form onSubmit={handleSubmitQuestion}>
              <div className="flex items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10">
                <textarea
                  ref={composerRef}
                  rows={1}
                  placeholder="Ask a question…"
                  value={questionText}
                  onChange={(e) => {
                    setQuestionText(e.target.value)
                    const el = composerRef.current
                    if (el) {
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.4) + 'px'
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmitQuestion(e)
                    }
                  }}
                  maxLength={5000}
                  className="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none text-sm leading-6 text-slate-800 placeholder:text-slate-400 py-0 overflow-y-auto"
                  style={{ maxHeight: '40vh' }}
                />
                <button
                  type="submit"
                  disabled={!questionText.trim()}
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm active:scale-95"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>

              {/* Identity + hint row */}
              <div className="flex items-center justify-between mt-2 px-0.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIdentityOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors duration-100 select-none"
                  >
                    {isAnonymous ? (
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {(localDisplayName || '?')[0].toUpperCase()}
                      </span>
                    )}
                    {isAnonymous ? 'Anonymous' : localDisplayName}
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {identityOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIdentityOpen(false)} />
                      <div className="absolute bottom-full left-0 mb-1.5 z-20 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => { setIsAnonymous(true); setIdentityOpen(false) }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors duration-100 ${isAnonymous ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          Stay anonymous
                        </button>
                        {localDisplayName ? (
                          <button
                            type="button"
                            onClick={() => { setIsAnonymous(false); setIdentityOpen(false) }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors duration-100 ${!isAnonymous ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {localDisplayName[0].toUpperCase()}
                            </span>
                            Ask as {localDisplayName}
                          </button>
                        ) : (
                          <div className="px-3 py-2.5 border-t border-slate-100">
                            <p className="text-xs font-medium text-slate-500 mb-2">Reveal your name</p>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    const trimmed = nameInput.trim()
                                    if (!trimmed) return
                                    setLocalDisplayName(trimmed)
                                    setIsAnonymous(false)
                                    setIdentityOpen(false)
                                    setNameInput('')
                                    localStorage.setItem(`qs_session_${boardId}`, JSON.stringify({ display_name: trimmed, is_anonymous: false }))
                                  }
                                }}
                                placeholder="Your name"
                                maxLength={80}
                                autoFocus
                                className="flex-1 min-w-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                              />
                              <button
                                type="button"
                                disabled={!nameInput.trim()}
                                onClick={() => {
                                  const trimmed = nameInput.trim()
                                  if (!trimmed) return
                                  setLocalDisplayName(trimmed)
                                  setIsAnonymous(false)
                                  setIdentityOpen(false)
                                  setNameInput('')
                                  localStorage.setItem(`qs_session_${boardId}`, JSON.stringify({ display_name: trimmed, is_anonymous: false }))
                                }}
                                className="shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                              >
                                Set
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 select-none">Enter to post · Shift+Enter for new line</span>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-slate-200/80 bg-slate-50">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <p className="text-xs text-slate-500 text-center">This board is closed. No new questions can be posted.</p>
          </div>
        </div>
      )}

      {/* ── New questions floating pill ── */}
      {newQuestionCount > 0 && (
        <button
          onClick={handleScrollToNew}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-colors duration-150"
        >
          ↓ {newQuestionCount} new {newQuestionCount === 1 ? 'question' : 'questions'}
        </button>
      )}
    </div>
  )
}

// ─── Nav bar ─────────────────────────────────────────────────────────────────
function NavBar() {
  return (
    <header className="shrink-0 bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <span className="text-sm font-bold text-slate-800 tracking-tight">AthivaTech Q&amp;A</span>
      </div>
    </header>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function JoinBoardPage() {
  const { shareCode } = useParams()

  const [pageState, setPageState] = useState('loading')
  const [board, setBoard] = useState(null)
  const [session, setSession] = useState(null)
  const [invalidMsg, setInvalidMsg] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getBoardPreview(shareCode)
      .then((res) => {
        const b = res.data.board
        setBoard(b)

        // If user already has a session token for this board, go straight in
        const existingToken = localStorage.getItem(`qs_token_${b.id}`)
        if (existingToken) {
          const existingSession = getSession(b.id)
          setPublicBoardId(b.id)
          setSession(existingSession || { display_name: '', is_anonymous: true })
          setPageState('board')
        } else {
          setPageState('join')
        }
      })
      .catch((err) => {
        const status = err.response?.status
        if (status === 403) setInvalidMsg('Joining is currently disabled for this board.')
        else if (status === 410) setInvalidMsg('This board has ended and is no longer accepting participants.')
        else setInvalidMsg('This board link is invalid or no longer active.')
        setPageState('invalid')
      })
  }, [shareCode])

  async function handleRequestOtp(e) {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    try {
      await requestJoinOtp(shareCode, email.trim())
      setPageState('otp')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send code. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    if (otp.trim().length !== 6 || submitting) return
    setSubmitting(true)
    try {
      const res = await verifyJoinOtp(shareCode, email, otp.trim())
      const s = res.data
      localStorage.setItem(`qs_token_${board.id}`, s.session_token)
      localStorage.setItem(`qs_session_${board.id}`, JSON.stringify({
        display_name: s.display_name || '',
        is_anonymous: s.is_anonymous ?? true,
      }))
      setPublicBoardId(board.id)
      setSession({ display_name: s.display_name || '', is_anonymous: s.is_anonymous ?? true })
      setPageState('board')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid or expired code.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <NavBar />

      <div className="flex-1 min-h-0 flex flex-col">

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
          </div>
        )}

        {/* Invalid */}
        {pageState === 'invalid' && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-xs">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-800 mb-1.5">Board unavailable</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{invalidMsg}</p>
            </div>
          </div>
        )}

        {/* Email form */}
        {pageState === 'join' && board && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 leading-tight">{board.title}</h2>
                {board.description && (
                  <p className="text-sm text-slate-500 mt-1.5 leading-snug">{board.description}</p>
                )}
                <p className="text-sm text-slate-500 mt-3">Enter your Athiva email to join</p>
              </div>
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@athivatech.com"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white shadow-sm"
                />
                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                >
                  {submitting ? 'Sending…' : 'Send login code'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* OTP form */}
        {pageState === 'otp' && board && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  autoFocus
                  maxLength={6}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl font-mono tracking-widest text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white shadow-sm"
                />
                <button
                  type="submit"
                  disabled={submitting || otp.length !== 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                >
                  {submitting ? 'Verifying…' : 'Join board'}
                </button>
              </form>
              <button
                onClick={() => setPageState('join')}
                className="w-full mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Use a different email
              </button>
            </div>
          </div>
        )}

        {/* Board view */}
        {pageState === 'board' && board && session && (
          <BoardView board={board} session={session} boardId={board.id} />
        )}

      </div>
    </div>
  )
}
