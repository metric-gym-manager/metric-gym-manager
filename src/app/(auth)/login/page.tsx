'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Lock, Eye, EyeOff, Phone, MessageCircle } from 'lucide-react'
import { getSafeRedirect } from '@/features/auth'

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

  // Handle errors from URL parameters (e.g., email verification failures)
  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode])
    }
  }, [searchParams])

  // Login form
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    rememberMe: true,
  })

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setShowResendVerification(false)

    try {
      // Simple validation
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
        setIsLoading(false) // Only set to false on error

        // Show resend verification option if email verification is required
        if (result.errorCode === 'email_verification_required') {
          setShowResendVerification(true)
          setResendEmail(validatedData.email)
        }
        return
      }

      // Redirect to the originally-requested page (falling back to the
      // dashboard). Use a full-document navigation so the middleware re-runs
      // with the freshly-set session cookies. A client-side router push would
      // resolve the destination from the stale, pre-auth Router Cache — the
      // dashboard was prefetched/visited while signed out — and bounce the user
      // straight back to /login until a manual refresh.
      window.location.assign(getSafeRedirect(searchParams.get('redirect')))
      // Keep isLoading true — the full-page navigation unmounts this component.
    } catch (err) {
      setIsLoading(false) // Only set to false on error

      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0].toString()] = error.message
          }
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
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#ffffff' }}
    >
      <div className="w-full max-w-[440px] px-6 py-12">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 justify-center mb-12 group"
        >
          <div className="transition-transform duration-200 group-hover:scale-105">
            <Image src="/logo.svg" alt="Metric Logo" width={32} height={32} />
          </div>
          <span
            className="font-bold"
            style={{
              fontSize: '20px',
              letterSpacing: '-0.5px',
              color: '#1d1d1f',
            }}
          >
            Metric
          </span>
        </Link>

        <Card
          className="border-none shadow-none"
          style={{
            background: 'rgba(0, 0, 0, 0.02)',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            borderRadius: '18px',
          }}
        >
          <CardContent className="pt-10 pb-10 px-8">
            {/* Header */}
            <div className="mb-8 text-center">
              <h2
                className="font-bold mb-2"
                style={{
                  fontSize: '32px',
                  letterSpacing: '-0.02em',
                  color: '#1d1d1f',
                }}
              >
                Sign In
              </h2>
              <p style={{ fontSize: '15px', color: '#6e6e73' }}>
                Welcome back! Please enter your details.
              </p>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded">
                <p className="font-medium">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded">
                <p className="font-medium">{success}</p>
              </div>
            )}

            {showResendVerification && (
              <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-900 px-4 py-3 rounded space-y-3">
                <p className="font-bold">⚠️ Email Verification Required</p>
                <p className="text-sm">
                  Please enter your email to resend the verification link:
                </p>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="pl-10 border-yellow-400 focus:ring-yellow-500"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending || !resendEmail}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? 'Sending...' : 'Resend Verification Email'}
                </Button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    display: 'block',
                  }}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => {
                      setLoginForm({ ...loginForm, email: e.target.value })
                      setError(null)
                    }}
                    placeholder="your@email.com"
                    className={`pl-10 ${fieldErrors.email ? 'border-red-500' : ''}`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-sm text-red-500">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    display: 'block',
                  }}
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={(e) => {
                      setLoginForm({ ...loginForm, password: e.target.value })
                      setError(null)
                    }}
                    placeholder="Enter your password"
                    className={`pl-10 pr-10 ${fieldErrors.password ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-sm text-red-500">{fieldErrors.password}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={loginForm.rememberMe}
                    onChange={(e) =>
                      setLoginForm({
                        ...loginForm,
                        rememberMe: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                  />
                  <label
                    htmlFor="rememberMe"
                    style={{
                      fontSize: '13px',
                      color: '#6e6e73',
                    }}
                  >
                    Remember me
                  </label>
                </div>
                <Link
                  href="/forgot-password"
                  style={{
                    fontSize: '13px',
                    color: '#2563eb',
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white h-11"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              {/* Register Link */}
              <p
                className="text-center"
                style={{
                  fontSize: '13px',
                  color: '#6e6e73',
                  marginTop: '24px',
                }}
              >
                Don&apos;t have an account?{' '}
                <Link
                  href="/register"
                  style={{
                    color: '#2563eb',
                    fontWeight: 500,
                  }}
                >
                  Sign up for free
                </Link>
              </p>
            </form>

            {/* Support Section */}
            <div
              className="mt-8 pt-6 text-center"
              style={{
                borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  color: '#6e6e73',
                  marginBottom: '12px',
                }}
              >
                Need help?
              </p>
              <div className="flex justify-center gap-4">
                <a
                  href="tel:0704379967"
                  className="flex items-center gap-2 transition-colors"
                  style={{
                    fontSize: '13px',
                    color: '#1d1d1f',
                  }}
                >
                  <Phone className="h-4 w-4" />
                  <span>0704379967</span>
                </a>
                <a
                  href="https://wa.me/94704379967"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-colors"
                  style={{
                    fontSize: '13px',
                    color: '#1d1d1f',
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>WhatsApp</span>
                </a>
              </div>
              <div className="mt-3 space-y-1">
                <p style={{ fontSize: '11px', color: '#86868b' }}>
                  සහය අවශ්‍යනම්, 0704379967 අමතන්න
                </p>
                <p style={{ fontSize: '11px', color: '#86868b' }}>
                  ஏதேனும் உதவிக்கு, 0704379967 அழைக்கவும்
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
