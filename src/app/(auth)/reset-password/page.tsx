'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import AuthShell from '@/components/auth/AuthShell'
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from '@/features/auth/schemas/auth.schemas'

/**
 * Reset password — dark design.
 *
 * **This screen CARRIES the one-time token; it must never spend it.** Rendering
 * makes no Supabase call of any kind: the `token_hash` from the email link is
 * read out of the query string, held in component state, and posted only when
 * the user submits. `POST /api/auth/reset-password` is where it is verified.
 *
 * That ordering is the whole defence against email link scanners. The previous
 * design sent the link to `/auth/callback`, which called `verifyOtp` on GET —
 * so Gmail's scanner spent the token before the recipient clicked it (four
 * `403 One-time token not found` hits from Google IPs against one token, in the
 * production logs for 2026-09-11). A scanner issues GETs; it does not submit
 * forms. Do not add a fetch, a redirect, or a session check to this mount.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams()
  // `token_hash` is what `{{ .TokenHash }}` puts in the link. `token` is
  // accepted as an alias so a link built from an older template still works.
  const tokenHash =
    searchParams.get('token_hash') ?? searchParams.get('token') ?? ''

  const [formData, setFormData] = useState<Partial<ResetPasswordInput>>({
    password: '',
    confirmPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    try {
      const validatedData = resetPasswordSchema.parse({
        ...formData,
        token_hash: tokenHash,
      })
      setIsLoading(true)
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to reset password')
        return
      }
      // No logout call needed: `resetPassword()` signs out server-side, because
      // the session it created existed only to authorise the update.
      //
      // Auth-boundary navigation: the session was just mutated server-side, so
      // this must be a full-document load (§2.15). A `router.push` here would
      // serve the cached login route without re-running middleware.
      window.location.assign('/login?reset=success')
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach((e2) => {
          if (e2.path[0]) errors[e2.path[0].toString()] = e2.message
        })
        setFieldErrors(errors)
        setError('Please fix the errors below')
      } else {
        setError('An unexpected error occurred')
      }
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
            {tokenHash ? 'Create a new password' : 'Reset link incomplete'}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ma-t2)' }}>
            {tokenHash
              ? 'Min 8 characters with an uppercase, lowercase and number.'
              : 'This password reset link is missing its token. Request a new one — links are single-use and valid for 30 minutes.'}
          </p>
        </div>

        {!tokenHash ? (
          // Offering a form that cannot succeed wastes the user's time and
          // hides the real problem behind a generic failure after they type.
          <Link href="/forgot-password" className="mauth-btn">
            Request a new reset link
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && (
              <div className="mauth-alert mauth-alert-err">{error}</div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="mauth-label" htmlFor="reset-new-password">
                New password
              </label>
              <input
                id="reset-new-password"
                name="new-password"
                autoComplete="new-password"
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value })
                  setError(null)
                }}
                placeholder="Create a strong password"
                className="mauth-input mauth-input-mono"
                style={
                  fieldErrors.password
                    ? { borderColor: 'var(--ma-err)' }
                    : undefined
                }
              />
              {fieldErrors.password && (
                <span style={{ fontSize: 11, color: 'var(--ma-err)' }}>
                  {fieldErrors.password}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="mauth-label" htmlFor="reset-confirm-password">
                Confirm new password
              </label>
              <input
                id="reset-confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value })
                  setError(null)
                }}
                placeholder="Re-enter your password"
                className="mauth-input mauth-input-mono"
                style={
                  fieldErrors.confirmPassword
                    ? { borderColor: 'var(--ma-err)' }
                    : undefined
                }
              />
              {fieldErrors.confirmPassword && (
                <span style={{ fontSize: 11, color: 'var(--ma-err)' }}>
                  {fieldErrors.confirmPassword}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="mauth-btn mauth-btn-primary"
              style={{ marginTop: 4 }}
            >
              {isLoading ? 'Resetting…' : 'Reset password'}
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

/**
 * `useSearchParams` requires a Suspense boundary to avoid opting the whole
 * route into client-side rendering — the same wrapper `/verify-email` and
 * `/login` already use.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <p className="mauth-hint">Loading…</p>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
