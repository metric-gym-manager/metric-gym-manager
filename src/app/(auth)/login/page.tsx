'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import { Lock } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
// Deep import (not the `@/features/auth` barrel): this is a client component,
// and the barrel re-exports server-only services that pull in `next/headers`.
import { getSafeRedirect } from '@/features/auth/utils/getSafeRedirect'

const ERROR_MESSAGES: Record<string, string> = {
  missing_code:
    'Email verification link is invalid. Please try registering again.',
  verification_failed: 'Email verification failed. The link may have expired.',
  incomplete_registration:
    'Registration data is incomplete. Please register again.',
  profile_creation_failed:
    'Failed to create your profile. Please contact support.',
  username_taken:
    'Username was taken by another user during verification. Please register with a different username.',
  unexpected_error: 'An unexpected error occurred. Please try again.',
}

function LoginContent() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (errorCode && ERROR_MESSAGES[errorCode])
      setError(ERROR_MESSAGES[errorCode])
    if (searchParams.get('reset') === 'success')
      setSuccess('Password reset. Sign in with your new password.')
  }, [searchParams])

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    rememberMe: true,
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setShowResendVerification(false)

    try {
      const emailSchema = z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(1, 'Password is required'),
        rememberMe: z.boolean().optional(),
      })
      const validatedData = emailSchema.parse(loginForm)
      setIsLoading(true)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Login failed')
        setIsLoading(false)
        if (result.errorCode === 'email_verification_required') {
          setShowResendVerification(true)
          setResendEmail(validatedData.email)
        }
        return
      }

      // Full-document navigation so middleware re-runs with the fresh session
      // cookies (architecture §2.15).
      window.location.assign(getSafeRedirect(searchParams.get('redirect')))
    } catch (err) {
      setIsLoading(false)
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach((error) => {
          if (error.path[0]) errors[error.path[0].toString()] = error.message
        })
        setFieldErrors(errors)
        setError('Please fix the errors below')
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  const handleResendVerification = async () => {
    if (!resendEmail) {
      setError('Please enter your email address to resend verification')
      return
    }
    setIsResending(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      })
      const result = await response.json()
      if (result.success) {
        setSuccess(
          'Verification email sent! Please check your inbox and spam folder.'
        )
        setShowResendVerification(false)
      } else {
        setError(result.error || 'Failed to resend verification email')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthShell tab="login">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Sign in to your workspace
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ma-t2)' }}>
            Gym operator access. Members use the mobile app.
          </p>
        </div>

        {error && <div className="mauth-alert mauth-alert-err">{error}</div>}
        {success && <div className="mauth-alert mauth-alert-ok">{success}</div>}

        {showResendVerification && (
          <div className="mauth-alert mauth-alert-warn flex flex-col gap-2">
            <span style={{ fontWeight: 500 }}>Email verification required</span>
            <input
              aria-label="Email address for verification resend"
              name="resend-email"
              autoComplete="email"
              type="email"
              placeholder="you@yourgym.lk"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              className="mauth-input"
            />
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isResending || !resendEmail}
              className="mauth-btn mauth-btn-accent"
            >
              {isResending ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="mauth-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              autoComplete="username"
              type="email"
              value={loginForm.email}
              onChange={(e) => {
                setLoginForm({ ...loginForm, email: e.target.value })
                setError(null)
              }}
              placeholder="you@yourgym.lk"
              className="mauth-input"
              style={
                fieldErrors.email ? { borderColor: 'var(--ma-err)' } : undefined
              }
            />
            {fieldErrors.email && (
              <span style={{ fontSize: 11, color: 'var(--ma-err)' }}>
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline">
              <label className="mauth-label" htmlFor="login-password">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="mauth-btn-link"
                style={{ textDecoration: 'none' }}
              >
                Forgot?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                name="password"
                autoComplete="current-password"
                type={showPassword ? 'text' : 'password'}
                value={loginForm.password}
                onChange={(e) => {
                  setLoginForm({ ...loginForm, password: e.target.value })
                  setError(null)
                }}
                placeholder="••••••••••••"
                className="mauth-input mauth-input-mono"
                style={{
                  paddingRight: 52,
                  ...(fieldErrors.password
                    ? { borderColor: 'var(--ma-err)' }
                    : {}),
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="mauth-mono"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 9,
                  background: 'none',
                  border: 'none',
                  color: 'var(--ma-t3)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            {fieldErrors.password && (
              <span style={{ fontSize: 11, color: 'var(--ma-err)' }}>
                {fieldErrors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mauth-btn mauth-btn-primary"
            style={{ marginTop: 4 }}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-2 mauth-hint">
          <Lock width={12} height={12} strokeWidth={1.8} />
          <span>TLS 1.3 · SESSION EXPIRES AFTER 24H IDLE</span>
        </div>
        <div className="mauth-hint" style={{ textTransform: 'none' }}>
          Need help? Call or WhatsApp <a href="tel:0704379967">070 437 9967</a>
        </div>
      </div>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mauth-root">
          <div className="mauth-form-col">
            <p className="mauth-hint">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
