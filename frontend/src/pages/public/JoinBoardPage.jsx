import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getBoardPreview, requestJoinOtp, verifyJoinOtp } from '../../api/userAccess'
import { setPublicBoardId, getPublicBoard, getPublicQuestions, postPublicQuestion } from '../../api/publicQna'
import { getSession, saveSession } from '../../hooks/useUserSession'
import PublicQuestionCard from '../../components/public/PublicQuestionCard'

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i
const RESEND_COOLDOWN = 60

// ─── Skeleton ────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-slate-200 rounded w-32" />
          <div className="h-3 bg-slate-100 rounded w-20" />
        </div>
      </div>
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2" />
    </div>
  )
}

// ─── OTP digit input helpers ──────────────────────────────────────────────────
function OtpInput({ digits, setDigits, error, loading, inputRefs }) {
  function handleChange(e, idx) {
    const val = e.target.value.replace(/\D/g, '')
    if (!val) return
    const next = [...digits]
    next[idx] = val[val.length - 1]
    setDigits(next)
    if (idx < 5) inputRefs.current[idx + 1]?.focus()
  }
  function handleKeyDown(e, idx) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; setDigits(next)
      } else if (idx > 0) {
        const next = [...digits]; next[idx - 1] = ''; setDigits(next)
        inputRefs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) inputRefs.current[idx - 1]?.focus()
    else if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus()
  }
  function handlePaste(e) {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!paste) return
    const next = [...paste.split(''), ...Array(6).fill('')].slice(0, 6)
    setDigits(next)
    inputRefs.current[Math.min(paste.length, 5)]?.focus()
  }
  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={loading}
          aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className={[
            'w-11 h-12 text-center text-lg font-semibold rounded-lg border',
            'transition-all duration-150 focus:outline-none',
            'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-red-400 bg-red-50 text-red-900'
              : d ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-200 bg-white text-slate-900',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

// ─── Board view ───────────────────────────────────────────────────────────────
function BoardView({ board, session, boardId }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [questionText, setQuestionText] = useState('')
  const submittingRef = useRef(false)

  useEffect(() => {
    getPublicQuestions(boardId)
      .then((res) => setQuestions(res.data.questions || []))
      .catch(() => toast.error('Failed to load questions'))
      .finally(() => setLoading(false))
  }, [boardId])

  const isClosed = board.status === 'CLOSED' || (board.end_at && new Date() >= new Date(board.end_at))

  async function handleSubmitQuestion(e) {
    e.preventDefault()
    const text = questionText.trim()
    if (!text || submittingRef.current) return
    submittingRef.current = true

    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      text,
      author_name: session.is_anonymous ? 'Anonymous' : session.display_name,
      likes_count: 0,
      reply_count: 0,
      view_count: 0,
      liked_by_me: false,
      _isOptimistic: true,
      created_at: new Date().toISOString(),
    }
    setQuestions((prev) => [...prev, optimistic])
    setQuestionText('')

    try {
      const res = await postPublicQuestion(boardId, text)
      setQuestions((prev) => prev.map((q) => q.id === tempId ? { ...res.data.question, liked_by_me: false } : q))
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

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{board.title}</h2>
            {board.description && (
              <p className="mt-1 text-sm text-slate-500">{board.description}</p>
            )}
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isClosed
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {isClosed ? 'Closed' : 'Open'}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span>Joined as</span>
          <span className="font-medium text-slate-600">
            {session.is_anonymous ? 'Anonymous' : session.display_name}
          </span>
          <span className="text-slate-300">·</span>
          <span>{session.email}</span>
        </div>
      </div>

      {/* Question input */}
      {!isClosed && (
        <form onSubmit={handleSubmitQuestion} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <textarea
            className="w-full text-sm text-slate-900 placeholder:text-slate-400 bg-transparent border-0 outline-none resize-none leading-relaxed"
            rows={2}
            placeholder="Ask a question…"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            maxLength={5000}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              Posting as <span className="font-medium">{session.is_anonymous ? 'Anonymous' : session.display_name}</span>
            </span>
            <button
              type="submit"
              disabled={!questionText.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150"
            >
              Post
            </button>
          </div>
        </form>
      )}

      {/* Questions list */}
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
      ) : questions.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          No questions yet. Be the first to ask!
        </div>
      ) : (
        questions.map((q) => (
          <PublicQuestionCard
            key={q.id}
            question={q}
            boardId={boardId}
            isClosed={isClosed}
            session={session}
            onUpdate={handleQuestionUpdate}
            onDelete={handleQuestionDelete}
          />
        ))
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function JoinBoardPage() {
  const { shareCode } = useParams()

  // page state: 'loading' | 'invalid' | 'join' | 'otp' | 'board'
  const [pageState, setPageState] = useState('loading')
  const [board, setBoard] = useState(null)
  const [session, setSession] = useState(null)
  const [invalidMsg, setInvalidMsg] = useState('')

  // Join form state
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [serverError, setServerError] = useState('')
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [otpError, setOtpError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const loadingRef = useRef(false)
  const timerRef = useRef(null)
  const inputRefs = useRef([])

  const otp = digits.join('')

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    getBoardPreview(shareCode)
      .then((res) => {
        const b = res.data.board
        setBoard(b)

        // Check for existing session in localStorage
        const existing = getSession(b.id)
        if (existing?.session_token) {
          setPublicBoardId(b.id)
          setSession(existing)
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

  useEffect(() => {
    if (pageState === 'otp') setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }, [pageState])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function handleSendOtp(e) {
    e.preventDefault()
    setServerError('')
    if (!email.trim() || !ATHIVA_EMAIL.test(email.trim())) {
      setEmailError('Enter a valid @athivatech.com email')
      return
    }
    setEmailError('')
    if (loadingRef.current) return
    loadingRef.current = true
    setFormLoading(true)
    try {
      await requestJoinOtp(shareCode, email.trim())
      setPageState('otp')
      startCooldown()
    } catch (err) {
      const status = err.response?.status
      const serverMsg = err.response?.data?.error
      if (status === 429) setServerError('Too many requests. Please wait a few minutes.')
      else if (status === 404) setServerError(serverMsg || 'No account found for this email. Contact your administrator.')
      else if (status === 403) setServerError(serverMsg || 'Access denied.')
      else setServerError(serverMsg || 'Failed to send code. Please try again.')
    } finally {
      loadingRef.current = false
      setFormLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setServerError('')
    if (!otp.trim() || !/^\d{6}$/.test(otp.trim())) {
      setOtpError('Enter the 6-digit code from your email')
      return
    }
    setOtpError('')
    if (loadingRef.current) return
    loadingRef.current = true
    setFormLoading(true)
    try {
      const res = await verifyJoinOtp(shareCode, email.trim(), otp.trim())
      const sessionData = res.data
      saveSession(board.id, sessionData)
      setPublicBoardId(board.id)
      setSession(sessionData)
      setPageState('board')
    } catch (err) {
      const status = err.response?.status
      if (status === 429) setServerError('Too many failed attempts. Please request a new code.')
      else setServerError(err.response?.data?.error || 'Verification failed. Please try again.')
    } finally {
      loadingRef.current = false
      setFormLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loadingRef.current) return
    setServerError('')
    setDigits(Array(6).fill(''))
    setOtpError('')
    loadingRef.current = true
    setFormLoading(true)
    try {
      await requestJoinOtp(shareCode, email.trim())
      startCooldown()
    } catch (err) {
      setServerError(err.response?.data?.error || 'Failed to resend. Please try again.')
    } finally {
      loadingRef.current = false
      setFormLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-base font-semibold text-slate-800">AthivaTech Q&amp;A</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Loading */}
        {pageState === 'loading' && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
          </div>
        )}

        {/* Invalid */}
        {pageState === 'invalid' && (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Board unavailable</h2>
            <p className="text-sm text-slate-500">{invalidMsg}</p>
          </div>
        )}

        {/* Join form */}
        {(pageState === 'join' || pageState === 'otp') && board && (
          <div className="max-w-md mx-auto">
            {/* Board preview */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-800">{board.title}</h1>
              {board.description && (
                <p className="mt-1.5 text-sm text-slate-500">{board.description}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-200 p-8">
              {pageState === 'join' ? (
                <form onSubmit={handleSendOtp} noValidate className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 mb-1">Join this board</h2>
                    <p className="text-sm text-slate-500">Enter your company email to get a verification code.</p>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold tracking-widest text-slate-500 uppercase mb-1.5">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                      placeholder="you@athivatech.com"
                      disabled={formLoading}
                      className={[
                        'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900',
                        'placeholder:text-slate-400 focus:outline-none focus:ring-2',
                        'transition-all duration-150',
                        emailError
                          ? 'border-red-400 focus:ring-red-500/20 bg-red-50'
                          : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-400',
                      ].join(' ')}
                    />
                    {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                  </div>
                  {serverError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>}
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full h-10 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    {formLoading ? 'Sending code…' : 'Send verification code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} noValidate className="space-y-5">
                  <div className="text-center">
                    <h2 className="text-lg font-semibold text-slate-800 mb-1">Enter verification code</h2>
                    <p className="text-sm text-slate-500">We sent a 6-digit code to <strong>{email}</strong></p>
                  </div>
                  <OtpInput digits={digits} setDigits={setDigits} error={otpError} loading={formLoading} inputRefs={inputRefs} />
                  {otpError && <p className="text-xs text-red-500 text-center">{otpError}</p>}
                  {serverError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>}
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full h-10 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    {formLoading ? 'Verifying…' : 'Join board'}
                  </button>
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={cooldown > 0 || formLoading}
                      className="text-sm text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPageState('join'); setDigits(Array(6).fill('')); setOtpError(''); setServerError('') }}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      ← Change email
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Board view */}
        {pageState === 'board' && board && session && (
          <BoardView board={board} session={session} boardId={board.id} />
        )}
      </main>
    </div>
  )
}
