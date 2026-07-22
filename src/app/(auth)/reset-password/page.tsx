'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import AuthShell from '@/components/auth/AuthShell'
import { resetPasswordSchema, type ResetPasswordInput } from '@/features/auth/schemas/auth.schemas'

/**
 * Reset password — dark design. Same resetPasswordSchema +
 * POST /api/auth/reset-password wiring; redirects to /login?reset=success.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<Partial<ResetPasswordInput>>({ password: '', confirmPassword: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    try {
      const validatedData = resetPasswordSchema.parse(formData)
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
      router.push('/login?reset=success')
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
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Create a new password</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ma-t2)' }}>Min 8 characters with an uppercase, lowercase and number.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && <div className="mauth-alert mauth-alert-err">{error}</div>}
          <div className="flex flex-col gap-1.5">
            <label className="mauth-label">New password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setError(null) }}
              placeholder="Create a strong password"
              className="mauth-input mauth-input-mono"
              style={fieldErrors.password ? { borderColor: 'var(--ma-err)' } : undefined}
            />
            {fieldErrors.password && <span style={{ fontSize: 11, color: 'var(--ma-err)' }}>{fieldErrors.password}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="mauth-label">Confirm new password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); setError(null) }}
              placeholder="Re-enter your password"
              className="mauth-input mauth-input-mono"
              style={fieldErrors.confirmPassword ? { borderColor: 'var(--ma-err)' } : undefined}
            />
            {fieldErrors.confirmPassword && <span style={{ fontSize: 11, color: 'var(--ma-err)' }}>{fieldErrors.confirmPassword}</span>}
          </div>
          <button type="submit" disabled={isLoading} className="mauth-btn mauth-btn-primary" style={{ marginTop: 4 }}>
            {isLoading ? 'Resetting…' : 'Reset password'}
          </button>
          <Link href="/login" className="mauth-btn">Back to login</Link>
        </form>
      </div>
    </AuthShell>
  )
}
