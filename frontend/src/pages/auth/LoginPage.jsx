import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { requestOtp } from '../../api/auth'
import { Button } from '@/components/common/Button'
import { Label } from '@/components/common/Label'
import { inputCls, errorInputCls } from '@/utils/ui'
import { FormError } from '@/components/common/FormError'
import { Stack } from '@/components/common/Stack'

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i
const RESEND_COOLDOWN = 60

export default function LoginPage() {
  const { verifyOtp } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState('email') // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [emailError, setEmailError] = useState('')
  const [otpError, setOtpError] = useState('')
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const loadingRef = useRef(false)
  const timerRef = useRef(null)
  const inputRefs = useRef([])

  const otp = digits.join('')

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    }
  }, [step])

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
      setEmailError('Access denied. Please use a registered corporate account.')
      return
    }
    setEmailError('')
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      await requestOtp(email.trim())
      setStep('otp')
      startCooldown()
    } catch (err) {
      const status = err.response?.status
      if (status === 429) {
        setServerError('Too many requests. Please wait a few minutes and try again.')
      } else if (!err.response) {
        setServerError('Unable to connect. Please check your internet connection.')
      } else {
        setServerError(err.response?.data?.error || 'Failed to send code. Please try again.')
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
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
    setLoading(true)
    try {
      const userData = await verifyOtp(email.trim(), otp.trim())
      if (userData.role === 'admin') {
        navigate('/admin/qna', { replace: true })
      } else {
        navigate('/user/qna', { replace: true })
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 429) {
        setServerError('Too many failed attempts. Please request a new code.')
      } else if (!err.response) {
        setServerError('Unable to connect. Please check your internet connection.')
      } else {
        setServerError(err.response?.data?.error || 'Verification failed. Please try again.')
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loadingRef.current) return
    setServerError('')
    setDigits(Array(6).fill(''))
    setOtpError('')
    loadingRef.current = true
    setLoading(true)
    try {
      await requestOtp(email.trim())
      startCooldown()
    } catch (err) {
      setServerError(err.response?.data?.error || 'Failed to resend code. Please try again.')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  function handleOtpChange(e, idx) {
    const val = e.target.value.replace(/\D/g, '')
    if (!val) return
    const next = [...digits]
    next[idx] = val[val.length - 1]
    setDigits(next)
    setOtpError('')
    if (idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  function handleOtpKeyDown(e, idx) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; setDigits(next)
      } else if (idx > 0) {
        const next = [...digits]; next[idx - 1] = ''; setDigits(next)
        inputRefs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < 5) {
      inputRefs.current[idx + 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!paste) return
    const next = [...paste.split(''), ...Array(6).fill('')].slice(0, 6)
    setDigits(next)
    setOtpError('')
    inputRefs.current[Math.min(paste.length, 5)]?.focus()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-2xl shadow-slate-200/40 ring-1 ring-slate-200/60 px-7 pt-8 pb-6">

          {/* Header — centered */}
          <div className="mb-6 text-center">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-500/20">
              <span className="text-white text-lg font-bold select-none">A</span>
            </div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900 inline-flex items-center gap-1.5">
              {step === 'email' ? 'Sign in' : 'Check your inbox'}
              <svg className="w-[14px] h-[14px] text-slate-400 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 00-3.5 3.5V6H3a1 1 0 00-1 1v7a1 1 0 001 1h10a1 1 0 001-1V7a1 1 0 00-1-1h-1.5V4.5A3.5 3.5 0 008 1zm-2 5V4.5a2 2 0 114 0V6H6z" clipRule="evenodd" />
              </svg>
            </h1>
            {step === 'otp' && (
              <p className="text-sm text-slate-500 mt-1.5">
                {`A 6-digit code was sent to ${email}`}
              </p>
            )}
          </div>

          {step === 'email' ? (
            <Stack as="form" gap={4} onSubmit={handleSendOtp} noValidate>
              <Stack gap={1}>
                <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                  placeholder="name@company.com"
                  disabled={loading}
                  className={`${inputCls} shadow-inner shadow-slate-100 ${emailError ? errorInputCls : ''}`}
                />
                {emailError && <p className="text-xs text-red-500">{emailError}</p>}
              </Stack>
              <FormError message={serverError} />
              <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                {loading ? 'Sending code…' : 'Send code'}
              </Button>
            </Stack>
          ) : (
            <Stack as="form" gap={4} onSubmit={handleVerifyOtp} noValidate>
              <Stack gap={2}>
                <Label className="text-slate-700 font-medium text-center block">Enter your code</Label>
                <div className="flex gap-2.5 justify-center">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleOtpChange(e, i)}
                      onKeyDown={(e) => handleOtpKeyDown(e, i)}
                      onPaste={handleOtpPaste}
                      onFocus={(e) => e.target.select()}
                      disabled={loading}
                      aria-label={`Digit ${i + 1}`}
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      className={[
                        'w-11 h-12 text-center text-lg font-semibold rounded-lg border',
                        'transition-all duration-150 focus:outline-none',
                        'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        otpError
                          ? 'border-red-400 bg-red-50 text-red-900'
                          : d
                          ? 'border-slate-300 bg-white text-slate-900'
                          : 'border-slate-200 bg-white text-slate-900',
                      ].join(' ')}
                    />
                  ))}
                </div>
                {otpError && <p className="text-xs text-red-500 text-center mt-0.5">{otpError}</p>}
              </Stack>

              <FormError message={serverError} />

              <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
                {loading ? 'Verifying…' : 'Sign in'}
              </Button>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setDigits(Array(6).fill('')); setOtpError(''); setServerError('') }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  ← Back to email
                </button>
              </div>
            </Stack>
          )}

          {/* Copyright — inside card, very muted */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-300">
              &copy; {new Date().getFullYear()} AthivaTech
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
