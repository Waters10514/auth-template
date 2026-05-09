'use client'
import { useState, useRef, useEffect } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'

type Step = 'email' | 'password' | 'totp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)   // first-time: no password set yet
  const [qrUri, setQrUri] = useState<string | null>(null) // set when new TOTP secret generated
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'email') emailRef.current?.focus()
    else if (step === 'password') passwordRef.current?.focus()
    else if (step === 'totp') codeRef.current?.focus()
  }, [step])

  // ── Step 1: Check email ────────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Email not recognized'); return }
      setIsNewUser(!data.hasPassword)
      setStep('password')
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify (or set) password ──────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || loading) return
    if (isNewUser && password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (isNewUser && password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, isNew: isNewUser, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Invalid credentials'); return }
      if (data.qrUri) setQrUri(data.qrUri)
      setStep('totp')
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Verify TOTP ───────────────────────────────────────────────────
  async function handleTotpSubmit(codeOverride?: string) {
    const trimmed = (codeOverride ?? code).replace(/\s/g, '')
    if (trimmed.length !== 6 || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      if (res.ok) {
        window.location.href = '/digest'
      } else {
        const data = await res.json()
        setError(data.error ?? 'Invalid code')
        setCode('')
        codeRef.current?.focus()
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
    setError(null)
    if (val.length === 6) handleTotpSubmit(val)
  }

  const stepIndex = { email: 0, password: 1, totp: 2 }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white text-2xl font-bold">CI</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Career Insights</h1>
          <p className="text-slate-500 text-sm mt-1">
            {step === 'email' && 'Sign in to your account'}
            {step === 'password' && (isNewUser ? 'Create your password' : 'Enter your password')}
            {step === 'totp' && 'Two-factor authentication'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-7">
          {(['email', 'password', 'totp'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < stepIndex[step] ? 'bg-blue-400' :
                i === stepIndex[step] ? 'bg-blue-600' :
                'bg-slate-100'
              }`}
            />
          ))}
        </div>

        {/* ── Step 1: Email ─────────────────────────────────────────────── */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="you@example.com"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                autoComplete="email"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Checking…</> : 'Continue →'}
            </button>
          </form>
        )}

        {/* ── Step 2: Password ──────────────────────────────────────────── */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <p className="text-xs text-slate-400 -mt-1 mb-1">{email}</p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isNewUser ? 'Create a password' : 'Password'}
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  placeholder={isNewUser ? 'At least 8 characters' : ''}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 pr-11 text-slate-900 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  autoComplete={isNewUser ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isNewUser && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(null) }}
                  placeholder="Re-enter your password"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setStep('email'); setPassword(''); setConfirmPassword(''); setError(null) }}
                className="px-4 py-3 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading || !password}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</>
                  : isNewUser ? 'Set Password →' : 'Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: TOTP ──────────────────────────────────────────────── */}
        {step === 'totp' && (
          <div className="space-y-4">
            {qrUri ? (
              /* New user: show QR to scan */
              <div className="text-center space-y-3">
                <p className="text-sm text-slate-600">
                  Scan this QR code with <strong>Google Authenticator</strong>, then enter the 6-digit code below.
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUri)}&size=180x180&margin=10`}
                    alt="Google Authenticator QR code"
                    width={180}
                    height={180}
                    className="rounded-xl border border-slate-200"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Tap <strong>+</strong> in Google Authenticator → <em>Scan a QR code</em>
                </p>
              </div>
            ) : (
              /* Returning user: just prompt for code */
              <p className="text-sm text-slate-500 text-center">
                Open <strong>Google Authenticator</strong> and enter the 6-digit code for Career Insights
              </p>
            )}

            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={handleCodeChange}
              onKeyDown={e => e.key === 'Enter' && handleTotpSubmit()}
              placeholder="000 000"
              maxLength={6}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              autoComplete="one-time-code"
            />

            <button
              onClick={() => handleTotpSubmit()}
              disabled={loading || code.replace(/\D/g, '').length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</> : 'Sign In'}
            </button>

            <p className="text-xs text-slate-400 text-center">Code refreshes every 30 seconds</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-4 text-center text-sm text-red-600 bg-red-50 rounded-lg py-2 px-3">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
