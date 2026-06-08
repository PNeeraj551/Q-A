import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { requestOtp } from '../../api/auth'
import { Button } from '@/components/common/Button'
import { Label } from '@/components/common/Label'
import { inputCls, errorInputCls } from '@/utils/ui'
import { FormError } from '@/components/common/FormError'
import { Text } from '@/components/common/Text'
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
      setEmailError('Enter a valid email address')
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
        setServerError('Admin access only. Use your shared board link to participate.')
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-blue-50/50 to-indigo-50/40">

      {/* Navbar */}
      <header className="w-full bg-white/80 backdrop-blur border-b border-slate-200/80">
        <div className="w-full px-[12%] py-4 flex items-center justify-between">
          <span className="text-[22px] font-semibold text-slate-800 tracking-tight">AthivaTech Q&A</span>
          <Link
            to="/login"
            className="inline-flex items-center justify-center h-9 px-5 rounded-md text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 transition-all duration-150"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Page body */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">

          {/* Heading */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-slate-800">Sign in</h1>
            <p className="mt-2 text-sm text-slate-500">Enter your Athiva email to receive a login code</p>
          </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/70 border border-slate-200/80 p-8">

          {step === 'otp' && (
            <Text size="sm" className="mb-5 text-center text-slate-500">
              {`We sent a 6-digit code to ${email}`}
            </Text>
          )}

          {step === 'email' ? (
            <Stack as="form" gap={4} onSubmit={handleSendOtp} noValidate>
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
                  disabled={loading}
                  className={`${inputCls} ${emailError ? errorInputCls : ''}`}
                />
                {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
              </div>
              <FormError message={serverError} />
              <Button type="submit" className="w-full h-10 font-semibold bg-blue-800 hover:bg-blue-900" disabled={loading}>
                {loading ? 'Sending code…' : 'Send login code'}
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

              <Button type="submit" className="w-full h-10 font-semibold bg-blue-800 hover:bg-blue-900" disabled={loading}>
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
        </div>

          <div className="mt-4 text-center">
            <Text size="xs" color="muted">
              &copy; {new Date().getFullYear()} AthivaTech. All rights reserved.
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
