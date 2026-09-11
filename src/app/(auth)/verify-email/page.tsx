'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>(
    'pending'
  )
  const [message, setMessage] = useState('Verifying your email...')
  const [email, setEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(15)

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      )
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')
      const type = searchParams.get('type')
      const emailParam = searchParams.get('email')
      if (emailParam) setEmail(emailParam)

      if (type === 'signup') {
        setStatus('success')
        setMessage(
          'Email verification successful! You can now log in to your account.'
        )
        return
      }

      if (type === 'email_change' || type === 'email') {
        const tokenHash = searchParams.get('token_hash') || token
        if (!tokenHash) {
          setStatus('error')
          setMessage('Invalid verification link. No token provided.')
          return
        }
        try {
          setStatus('pending')
          setMessage('Verifying your email address...')
          const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenHash }),
          })
          const data = await response.json()
          if (response.ok && data.success) {
            setStatus('success')
            setMessage(
              'Email verified successfully! Please log in with your new email address.'
            )
            await fetch('/api/auth/logout', { method: 'POST' })
            setTimeout(() => router.push('/login'), 5000)
          } else {
            setStatus('error')
            setMessage(
              data.error ||
                'Failed to verify email. The link may be expired or invalid.'
            )
          }
        } catch {
          setStatus('error')
          setMessage('An unexpected error occurred while verifying your email.')
        }
        return
      }

      if (!token) {
        setStatus('pending')
        setMessage('Please check your email for a verification link.')
      }
    }
    verifyEmail()
  }, [searchParams, router])

  const handleResendEmail = async () => {
    if (!email || email.trim() === '') {
      setResendMessage('Please enter your email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setResendMessage('Please enter a valid email address')
      return
    }
    setIsResending(true)
    setResendMessage(null)
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const result = await response.json()
      if (result.success) {
        setResendMessage(
          'Verification email sent! Check your inbox and spam folder.'
        )
        setResendCooldown(15)
      } else {
        setResendMessage(result.error || 'Failed to resend email')
      }
    } catch {
      setResendMessage('An unexpected error occurred. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const resendSent = resendMessage?.toLowerCase().includes('sent')

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="mauth-hint">STEP 03 · CONFIRM IDENTITY</span>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            {status === 'success'
              ? 'Email verified'
              : status === 'error'
                ? 'Verification failed'
                : 'Verify your email to continue'}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--ma-t2)',
              textWrap: 'pretty',
            }}
          >
            {status === 'pending' ? (
              <>
                We sent a confirmation link
                {email ? (
                  <>
                    {' '}
                    to{' '}
                    <span style={{ color: 'var(--ma-t1)', fontWeight: 500 }}>
                      {email}
                    </span>
                  </>
                ) : (
                  ''
                )}
                . Open it to activate your workspace.
              </>
            ) : status === 'error' ? (
              // Fixed copy on error. `message` carries the server's specific
              // reason and is rendered by the alert below — putting it here too
              // printed the same sentence on two consecutive lines.
              <>
                We couldn&apos;t confirm this link. The reason is below; you can
                request a new one from the login page.
              </>
            ) : (
              message
            )}
          </p>
        </div>

        {status === 'success' && (
          <div className="mauth-alert mauth-alert-ok">
            You&apos;re all set. Redirecting to login… or{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mauth-btn-link"
              style={{ textDecoration: 'underline' }}
            >
              go now
            </button>
            .
          </div>
        )}
        {status === 'error' && (
          <div className="mauth-alert mauth-alert-err">{message}</div>
        )}

        {status === 'pending' && (
          <>
            {/* Inbox status — log-widget aesthetic */}
            <div className="mauth-log">
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '9px 12px',
                  borderBottom: '1px solid var(--ds-border-subtle)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--ma-warn)',
                    boxShadow: '0 0 0 3px var(--ds-warning-border)',
                    flexShrink: 0,
                  }}
                />
                <span
                  className="mauth-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    color: 'var(--ma-warn)',
                  }}
                >
                  AWAITING CONFIRMATION
                </span>
              </div>
              <div
                className="mauth-mono"
                style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: 'var(--ma-t3)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--ma-ok)' }}>→</span> Delivered to
                  inbox provider
                </div>
                <div>
                  <span style={{ color: 'var(--ma-t3)' }}>·</span> Not in inbox
                  yet? Check the spam / promotions folder
                </div>
                <div>
                  <span style={{ color: 'var(--ma-t3)' }}>·</span> Link valid
                  for 30 minutes from send
                </div>
              </div>
            </div>

            {/* Resend */}
            <div
              className="flex flex-col gap-2.5"
              style={{ borderTop: '1px solid var(--ma-b1)', paddingTop: 20 }}
            >
              {/* A prompt, not the field's name. Associating it would have a
                  screen reader announce the input as "Didn't receive it?",
                  which is worse than the silence it replaces — so the visible
                  text stays a span and the field names itself. */}
              <span className="mauth-label">Didn&apos;t receive it?</span>
              <input
                aria-label="Email address"
                name="email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourgym.lk"
                className="mauth-input"
              />
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={isResending || !email || resendCooldown > 0}
                className="mauth-btn mauth-btn-accent"
              >
                {isResending
                  ? 'Sending…'
                  : resendCooldown > 0
                    ? `Resend verification email (${resendCooldown}s)`
                    : 'Resend verification email'}
              </button>
              {resendMessage && (
                <span
                  style={{
                    fontSize: 12,
                    color: resendSent ? 'var(--ma-ok)' : 'var(--ma-err)',
                  }}
                >
                  {resendMessage}
                </span>
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="mauth-btn"
            style={{ flex: 1 }}
          >
            Back to login
          </button>
          {status !== 'error' && (
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mauth-btn"
              style={{
                flex: 1,
                borderColor: 'transparent',
                color: 'var(--ma-link)',
              }}
            >
              I&apos;ve verified →
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mauth-hint">
          <Mail width={12} height={12} strokeWidth={1.8} />
          <span>SINGLE-USE LINK · WORKSPACE LOCKED UNTIL CONFIRMED</span>
        </div>
      </div>
    </AuthShell>
  )
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  )
}
