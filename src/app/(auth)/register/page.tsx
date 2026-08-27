'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import AuthShell from '@/components/auth/AuthShell'
import {
  registrationSchema,
  type RegistrationInput,
} from '@/features/auth/schemas/auth.schemas'

/**
 * Register — dark 2-step design ("Auth Pages.dc.html").
 * Step 01 ACCOUNT (username / email / password) → step 02 GYM PROFILE
 * (gym name / address / website). Same registrationSchema + POST
 * /api/auth/register, then on to /verify-email.
 */
export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState<Partial<RegistrationInput>>({
    gymName: '',
    gymAddress: '',
    gymWebsite: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: keyof RegistrationInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    setError(null)
  }

  const getPasswordStrength = (password: string) => {
    if (!password) return { pct: '0%', color: 'var(--ma-t3)', label: '—' }
    let s = 0
    if (password.length >= 8) s++
    if (/[a-z]/.test(password)) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^a-zA-Z0-9]/.test(password)) s++
    if (s <= 2) return { pct: '33%', color: 'var(--ma-err)', label: 'WEAK' }
    if (s === 3) return { pct: '55%', color: 'var(--ma-warn)', label: 'FAIR' }
    if (s === 4) return { pct: '80%', color: 'var(--ma-ok)', label: 'GOOD' }
    return { pct: '100%', color: 'var(--ma-ok)', label: 'STRONG' }
  }
  const pw = getPasswordStrength(formData.password || '')

  // Step 1 = account credentials.
  const validateStep1 = (): boolean => {
    const step1Schema = z
      .object({
        username: z
          .string()
          .min(3, 'Username must be at least 3 characters')
          .max(50, 'Username must not exceed 50 characters'),
        email: z.string().email('Must be a valid email address'),
        password: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Add at least one uppercase letter')
          .regex(/[a-z]/, 'Add at least one lowercase letter')
          .regex(/[0-9]/, 'Add at least one number'),
        confirmPassword: z.string(),
      })
      .refine((d) => d.password === d.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      })
    try {
      step1Schema.parse({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      })
      setFieldErrors({})
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0].toString()] = e.message
        })
        setFieldErrors(errors)
      }
      return false
    }
  }

  const handleNextStep = () => {
    if (validateStep1()) setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    try {
      const validatedData = registrationSchema.parse(formData)
      setIsLoading(true)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error || 'Registration failed')
        setIsLoading(false)
        return
      }
      router.push(
        `/verify-email?email=${encodeURIComponent(validatedData.email)}`
      )
    } catch (err) {
      setIsLoading(false)
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach((e) => {
          if (e.path[0]) errors[e.path[0].toString()] = e.message
        })
        setFieldErrors(errors)
        // A gym-field error means the user must go back to step 2's form.
        setError('Please fix the highlighted fields')
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  return (
    <AuthShell tab="register">
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
            Create your gym account
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ma-t2)' }}>
            30-day trial. No payment method required.
          </p>
        </div>

        {/* Step indicator */}
        <div
          className="flex items-center gap-2.5 mauth-mono"
          style={{ fontSize: 11 }}
        >
          <span style={{ color: step === 1 ? 'var(--ma-t1)' : 'var(--ma-t3)' }}>
            01 ACCOUNT
          </span>
          <span
            style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }}
          />
          <span style={{ color: step === 2 ? 'var(--ma-t1)' : 'var(--ma-t3)' }}>
            02 GYM PROFILE
          </span>
        </div>

        {error && <div className="mauth-alert mauth-alert-err">{error}</div>}

        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <Field
              label="Username"
              htmlFor="register-username"
              error={fieldErrors.username}
            >
              <input
                id="register-username"
                name="username"
                autoComplete="username"
                value={formData.username || ''}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="e.g. titan_admin"
                className="mauth-input"
              />
            </Field>
            <Field
              label="Email"
              htmlFor="register-email"
              error={fieldErrors.email}
            >
              <input
                id="register-email"
                name="email"
                autoComplete="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="you@yourgym.lk"
                className="mauth-input"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="register-password"
              error={fieldErrors.password}
            >
              <div style={{ position: 'relative' }}>
                <input
                  id="register-password"
                  name="new-password"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password || ''}
                  onChange={(e) =>
                    handleInputChange('password', e.target.value)
                  }
                  placeholder="Min. 8 characters"
                  className="mauth-input mauth-input-mono"
                  style={{ paddingRight: 52 }}
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
              <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.09)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: pw.pct,
                      background: pw.color,
                      transition: 'width 0.15s ease',
                    }}
                  />
                </div>
                <span
                  className="mauth-mono"
                  style={{
                    fontSize: 11,
                    color: pw.color,
                    width: 54,
                    textAlign: 'right',
                  }}
                >
                  {pw.label}
                </span>
              </div>
            </Field>
            <Field
              label="Confirm password"
              htmlFor="register-confirm-password"
              error={fieldErrors.confirmPassword}
            >
              <input
                id="register-confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                type="password"
                value={formData.confirmPassword || ''}
                onChange={(e) =>
                  handleInputChange('confirmPassword', e.target.value)
                }
                placeholder="Re-enter password"
                className="mauth-input mauth-input-mono"
              />
            </Field>
            <button
              type="button"
              onClick={handleNextStep}
              className="mauth-btn mauth-btn-primary"
              style={{ marginTop: 4 }}
            >
              Continue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Field
              label="Gym name"
              htmlFor="register-gym-name"
              error={fieldErrors.gymName}
            >
              <input
                id="register-gym-name"
                name="organization"
                autoComplete="organization"
                value={formData.gymName || ''}
                onChange={(e) => handleInputChange('gymName', e.target.value)}
                placeholder="e.g. Titan Fitness"
                className="mauth-input"
              />
            </Field>
            <Field
              label="Address"
              htmlFor="register-gym-address"
              error={fieldErrors.gymAddress}
            >
              <input
                id="register-gym-address"
                name="street-address"
                autoComplete="street-address"
                value={formData.gymAddress || ''}
                onChange={(e) =>
                  handleInputChange('gymAddress', e.target.value)
                }
                placeholder="Street, city"
                className="mauth-input"
              />
            </Field>
            <Field
              label="Website (optional)"
              htmlFor="register-gym-website"
              error={fieldErrors.gymWebsite}
            >
              <input
                id="register-gym-website"
                name="url"
                autoComplete="url"
                value={formData.gymWebsite || ''}
                onChange={(e) =>
                  handleInputChange('gymWebsite', e.target.value)
                }
                placeholder="https://yourgym.lk"
                className="mauth-input"
              />
            </Field>
            <div className="flex gap-2" style={{ marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mauth-btn"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="mauth-btn mauth-btn-accent"
                style={{ flex: 1 }}
              >
                {isLoading ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        )}

        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: 'var(--ma-t3)',
            textWrap: 'pretty',
          }}
        >
          By creating an account you agree to the{' '}
          <a href="/terms">Terms of Service</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </AuthShell>
  )
}

/**
 * A labelled field.
 *
 * `htmlFor` is required rather than derived. The obvious alternatives both
 * have costs this page does not need to pay: `useId()` is a documented
 * hydration hazard in this codebase (architecture rule 2.12), and cloning the
 * child to inject an id makes the association invisible at the call site. An
 * explicit id is greppable, stable across renders, and impossible to get
 * half-right.
 */
function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="mauth-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && (
        <span style={{ fontSize: 11, color: 'var(--ma-err)' }}>{error}</span>
      )}
    </div>
  )
}
