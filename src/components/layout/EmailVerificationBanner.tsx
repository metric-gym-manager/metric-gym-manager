'use client'

import { useState } from 'react'
import { X, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { toast } from 'sonner'

interface EmailVerificationBannerProps {
  email: string
}

export function EmailVerificationBanner({
  email,
}: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isResending, setIsResending] = useState(false)

  const handleResendEmail = async () => {
    setIsResending(true)
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        toast.error(result.error || 'Failed to resend verification email')
      }
    } catch {
      toast.error('Failed to resend verification email')
    } finally {
      setIsResending(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="bg-warning-bg border-b border-warning-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-warning">
                <span className="font-semibold">
                  Verify your email address.
                </span>{' '}
                Please check your inbox (and spam folder) for a verification
                email sent to <span className="font-medium">{email}</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendEmail}
              disabled={isResending}
              className="text-warning hover:text-warning hover:bg-warning-bg"
            >
              <Mail className="h-4 w-4 mr-1.5" />
              {isResending ? 'Sending...' : 'Resend Email'}
            </Button>

            <button
              onClick={() => setIsVisible(false)}
              className="text-warning hover:opacity-80 p-1"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
