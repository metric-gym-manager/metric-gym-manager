'use client'

import { useState } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import AuthShell from '@/components/auth/AuthShell'
import { forgotPasswordSchema } from '@/features/auth/schemas/auth.schemas'

/**
 * Forgot password — dark design ("Auth Pages.dc.html" reset flow, presented as
 * a standalone screen for the existing /forgot-password route). Same
 * POST /api/auth/forgot-password wiring.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const validatedData = forgotPasswordSchema.parse({ email })
      setIsLoading(true)
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to send reset email')
        return
      }
      setSuccess(true)
    } catch (err) {
      if (err instanceof z.ZodError)
        setError(err.errors[0]?.message || 'Invalid email address')
      else setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="mauth-hint">RESET PASSWORD</span>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Reset your password
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--ma-t2)',
              textWrap: 'pretty',
            }}
          >
            Enter your account email. If it exists, a single-use reset link
            (valid 30 minutes) will be sent.
          </p>
        </div>

        {success ? (
          <>
            <div className="mauth-alert mauth-alert-ok">
              If an account exists for <strong>{email}</strong>, a reset link is
              on its way. Check your inbox and spam / promotions folder.
            </div>
            <Link
              href="/login"
              className="mauth-btn mauth-btn-primary"
              style={{ textDecoration: 'none' }}
            >
              Back to login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && (
              <div className="mauth-alert mauth-alert-err">{error}</div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="mauth-label" htmlFor="forgot-email">
                Email
              </label>
              <input
                id="forgot-email"
                name="email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="you@yourgym.lk"
                required
                className="mauth-input"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="mauth-btn mauth-btn-primary"
              style={{ marginTop: 4 }}
            >
              {isLoading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link href="/login" className="mauth-btn">
              Back to login
            </Link>
          </form>
        )}
      </div>
    </AuthShell>
  )
}
