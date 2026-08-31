'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useNow } from '@/hooks/useNow'

// localStorage never notifies subscribers — snapshot-only external store
const emptyStoreSubscribe = () => () => {}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lightbulb, Info, X, AlertTriangle } from 'lucide-react'
import { Card, Modal, Button, Input, Label } from '@/components/ui'
import {
  updatePasswordSchema,
  updateEmailSchema,
  type UpdatePasswordInput,
  type UpdateEmailInput,
} from '@/features/settings/schemas/settings.schemas'

// Username update schema
const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
})

type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>

// ============================================================
// PASSWORD CHANGE MODAL
// ============================================================

function PasswordChangeModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: UpdatePasswordInput) => {
      const response = await fetch('/api/settings/security/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update password')
      }

      return response.json()
    },
    onSuccess: () => {
      // Store password change timestamp in localStorage for reminder
      localStorage.setItem('password_changed_at', new Date().toISOString())
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] })

      setSuccessMessage(
        'Password updated successfully. Use your new password for future logins.'
      )
      reset()
      setTimeout(() => {
        setSuccessMessage(null)
        onClose()
      }, 3000)
    },
  })

  const onSubmit = (data: UpdatePasswordInput) => {
    updateMutation.mutate(data)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="md"
      title="Change Password"
      description="Enter your current password and choose a new password"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="password-change-form"
            variant="accent"
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Updating...' : 'Update Password'}
          </Button>
        </>
      }
    >
      <form
        id="password-change-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* Current Password */}
        <div>
          <Label htmlFor="current_password">Current Password *</Label>
          <Input
            id="current_password"
            type="password"
            {...register('current_password')}
            placeholder="Enter current password"
          />
          {errors.current_password && (
            <p className="text-sm text-error mt-1">
              {errors.current_password.message}
            </p>
          )}
        </div>

        {/* New Password */}
        <div>
          <Label htmlFor="new_password">New Password *</Label>
          <Input
            id="new_password"
            type="password"
            {...register('new_password')}
            placeholder="Enter new password"
          />
          {errors.new_password && (
            <p className="text-sm text-error mt-1">
              {errors.new_password.message}
            </p>
          )}
          <p className="text-xs text-ink-muted mt-1">
            Must be at least 8 characters with uppercase, lowercase, and number
          </p>
        </div>

        {/* Confirm Password */}
        <div>
          <Label htmlFor="confirm_password">Confirm New Password *</Label>
          <Input
            id="confirm_password"
            type="password"
            {...register('confirm_password')}
            placeholder="Confirm new password"
          />
          {errors.confirm_password && (
            <p className="text-sm text-error mt-1">
              {errors.confirm_password.message}
            </p>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="rounded-sm bg-success-bg p-3">
            <p className="text-sm text-success">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {updateMutation.isError && (
          <div className="rounded-sm bg-error-bg p-3">
            <p className="text-sm text-error">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Failed to update password'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}

// ============================================================
// USERNAME UPDATE MODAL
// ============================================================

function UsernameUpdateModal({
  open,
  onClose,
  currentUsername,
}: {
  open: boolean
  onClose: () => void
  currentUsername: string
}) {
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateUsernameInput>({
    resolver: zodResolver(updateUsernameSchema),
    defaultValues: {
      username: currentUsername,
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateUsernameInput) => {
      const response = await fetch('/api/settings/security/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update username')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] })
      setSuccessMessage('Username updated successfully')
      setTimeout(() => {
        setSuccessMessage(null)
        onClose()
      }, 2000)
    },
  })

  const onSubmit = (data: UpdateUsernameInput) => {
    updateMutation.mutate(data)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="md"
      title="Update Username"
      description="Choose a new username for your account"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="username-update-form"
            variant="accent"
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Updating...' : 'Update Username'}
          </Button>
        </>
      }
    >
      <form
        id="username-update-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* Current Username (read-only) */}
        <div>
          <Label>Current Username</Label>
          <Input
            value={currentUsername}
            disabled
            className="bg-surface-input"
          />
        </div>

        {/* New Username */}
        <div>
          <Label htmlFor="username">New Username *</Label>
          <Input
            id="username"
            {...register('username')}
            placeholder="Enter new username"
          />
          {errors.username && (
            <p className="text-sm text-error mt-1">{errors.username.message}</p>
          )}
          <p className="text-xs text-ink-muted mt-1">
            3-50 characters, letters, numbers, hyphens, and underscores only
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="rounded-sm bg-success-bg p-3">
            <p className="text-sm text-success">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {updateMutation.isError && (
          <div className="rounded-sm bg-error-bg p-3">
            <p className="text-sm text-error">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Failed to update username'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}

// ============================================================
// EMAIL UPDATE MODAL
// ============================================================

function EmailUpdateModal({
  open,
  onClose,
  currentEmail,
}: {
  open: boolean
  onClose: () => void
  currentEmail: string
}) {
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateEmailInput>({
    resolver: zodResolver(updateEmailSchema),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateEmailInput) => {
      const response = await fetch('/api/settings/security/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update email')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Immediately refresh the profile to show new email with unverified status
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] })

      setSuccessMessage(
        data.message || 'Verification email sent. Check your inbox to confirm.'
      )
      reset()
      // Don't auto-close - let user read the message and see the updated email
    },
  })

  const onSubmit = (data: UpdateEmailInput) => {
    updateMutation.mutate(data)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="md"
      title="Update Email Address"
      description="Enter your new email address. You'll need to verify it before the change takes effect."
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="email-update-form"
            variant="accent"
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending
              ? 'Sending...'
              : 'Send Verification Email'}
          </Button>
        </>
      }
    >
      <form
        id="email-update-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* Current Email (read-only) */}
        <div>
          <Label>Current Email</Label>
          <Input value={currentEmail} disabled className="bg-surface-input" />
        </div>

        {/* New Email */}
        <div>
          <Label htmlFor="email">New Email Address *</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="Enter new email address"
          />
          {errors.email && (
            <p className="text-sm text-error mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="rounded-sm bg-success-bg p-3">
            <p className="text-sm text-success">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {updateMutation.isError && (
          <div className="rounded-sm bg-error-bg p-3">
            <p className="text-sm text-error">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Failed to update email'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}

// ============================================================
// PHONE UPDATE MODAL
// ============================================================

function PhoneUpdateModal({
  open,
  onClose,
  currentPhone,
}: {
  open: boolean
  onClose: () => void
  currentPhone: string | null
}) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch('/api/settings/security/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send OTP')
      }

      return response.json()
    },
    onSuccess: () => {
      setPhoneError(null)
      setStep('otp')
    },
    onError: (error: Error) => {
      setPhoneError(error.message)
    },
  })

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ phone, otp }: { phone: string; otp: string }) => {
      const response = await fetch('/api/settings/security/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp_code: otp }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to verify OTP')
      }

      return response.json()
    },
    onSuccess: () => {
      setOtpError(null)
      setSuccessMessage('Phone number updated successfully')
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] })
      setTimeout(() => {
        handleClose()
      }, 2000)
    },
    onError: (error: Error) => {
      setOtpError(error.message)
    },
  })

  const handleClose = () => {
    setStep('phone')
    setPhoneNumber('')
    setOtpCode('')
    setPhoneError(null)
    setOtpError(null)
    setSuccessMessage(null)
    onClose()
  }

  const handleSendOtp = () => {
    // Normalize phone number (convert 0771234567 to +94771234567)
    let normalizedPhone = phoneNumber.trim()

    // Remove spaces
    normalizedPhone = normalizedPhone.replace(/\s/g, '')

    // Convert local format to international
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+94' + normalizedPhone.substring(1)
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+94' + normalizedPhone
    }

    // Validate format
    if (!/^\+94[0-9]{9}$/.test(normalizedPhone)) {
      setPhoneError('Invalid phone number. Use format: 0771234567')
      return
    }

    requestOtpMutation.mutate(normalizedPhone)
  }

  const handleVerifyOtp = () => {
    // Validate OTP format
    if (!/^[0-9]{6}$/.test(otpCode)) {
      setOtpError('OTP must be 6 digits')
      return
    }

    verifyOtpMutation.mutate({ phone: phoneNumber, otp: otpCode })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
      size="md"
      title="Update Phone Number"
      description={
        step === 'phone'
          ? 'Enter your new phone number. We will send you a verification code.'
          : 'Enter the 6-digit code sent to your phone.'
      }
      footerStart={
        step === 'otp' ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep('phone')}
            disabled={verifyOtpMutation.isPending}
          >
            Back
          </Button>
        ) : undefined
      }
      footer={
        step === 'phone' ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={requestOtpMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={handleSendOtp}
              loading={requestOtpMutation.isPending}
              disabled={requestOtpMutation.isPending || !phoneNumber}
            >
              {requestOtpMutation.isPending ? 'Sending...' : 'Send OTP'}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => requestOtpMutation.mutate(phoneNumber)}
              disabled={
                requestOtpMutation.isPending || verifyOtpMutation.isPending
              }
            >
              Resend OTP
            </Button>
            <Button
              variant="accent"
              onClick={handleVerifyOtp}
              loading={verifyOtpMutation.isPending}
              disabled={verifyOtpMutation.isPending || !otpCode}
            >
              {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {step === 'phone' ? (
          <>
            {/* Current Phone (read-only) */}
            <div>
              <Label>Current Phone</Label>
              <Input
                value={currentPhone || 'Not set'}
                disabled
                className="bg-surface-input"
              />
            </div>

            {/* New Phone */}
            <div>
              <Label htmlFor="phone_number">New Phone Number *</Label>
              <Input
                id="phone_number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value)
                  setPhoneError(null)
                }}
                placeholder="0771234567"
              />
              {phoneError && (
                <p className="text-sm text-error mt-1">{phoneError}</p>
              )}
              <p className="text-xs text-ink-muted mt-1">
                Enter your Sri Lankan mobile number (e.g., 0771234567)
              </p>
            </div>
          </>
        ) : (
          <>
            {/* OTP Input */}
            <div>
              <Label htmlFor="otp_code">Verification Code *</Label>
              <Input
                id="otp_code"
                type="text"
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setOtpError(null)
                }}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
              {otpError && (
                <p className="text-sm text-error mt-1">{otpError}</p>
              )}
              <p className="text-xs text-ink-muted mt-1">
                Code expires in 10 minutes
              </p>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="rounded-sm bg-success-bg p-3">
                <p className="text-sm text-success">{successMessage}</p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ============================================================
// MAIN ACCOUNT SECURITY PAGE
// ============================================================

export default function AccountSecurityPage() {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [phoneModalOpen, setPhoneModalOpen] = useState(false)
  const [usernameModalOpen, setUsernameModalOpen] = useState(false)
  const [passwordReminderDismissed, setPasswordReminderDismissed] =
    useState(false)

  // Fetch current gym profile
  const { data: gymProfile } = useQuery({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      const result = await response.json()
      return result.data
    },
  })

  // Check for recent password change (within last 3 days). Reading the
  // client-only marker through useSyncExternalStore avoids setState-in-effect.
  const passwordChangedAt = useSyncExternalStore(
    emptyStoreSubscribe,
    () => localStorage.getItem('password_changed_at'),
    () => null
  )
  const now = useNow()
  const daysSincePasswordChange = passwordChangedAt
    ? (now - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity
  const showPasswordReminder =
    !passwordReminderDismissed && daysSincePasswordChange < 3

  // Clean up the marker once the reminder window has passed
  useEffect(() => {
    if (passwordChangedAt && daysSincePasswordChange >= 3) {
      localStorage.removeItem('password_changed_at')
    }
  }, [passwordChangedAt, daysSincePasswordChange])

  const dismissPasswordReminder = () => {
    setPasswordReminderDismissed(true)
    localStorage.removeItem('password_changed_at')
  }

  const maskPhone = (phone: string | null) => {
    if (!phone) return 'Not set'
    // Mask phone number: +94 XX XXX XXXX
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 11) return phone
    return `+${cleaned.slice(0, 2)} XX XXX ${cleaned.slice(-4)}`
  }

  return (
    <div className="max-w-3xl">
      <div className="space-y-6">
        {/* Description */}
        <div>
          <h2 className="text-lg font-semibold">Account Security</h2>
          <p className="text-sm text-ink-secondary mt-1">
            Manage your account security settings including password, email, and
            phone number
          </p>
        </div>

        {/* Password Change Reminder Banner */}
        {showPasswordReminder && (
          <div className="rounded-sm border border-accentui-border bg-accentui-bg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-brand-link" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Password Recently Updated
                  </h3>
                  <p className="text-sm text-ink-secondary mt-1">
                    Your password was recently changed. Please use your new
                    password for future logins.
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    This reminder will be shown for 3 days.
                  </p>
                </div>
              </div>
              <button
                onClick={dismissPasswordReminder}
                className="flex-shrink-0 text-brand-link hover:text-brand-link-hover"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {/* Security Settings */}
        <div className="space-y-4">
          {/* Username Section */}
          <Card className="p-6">
            <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <div>
                <h3 className="text-base font-semibold">Username</h3>
                <p className="text-sm text-ink-secondary mt-1">
                  {gymProfile?.username || 'Loading...'}
                </p>
                <p className="text-xs text-ink-muted mt-2">
                  Your unique identifier displayed in the system
                </p>
              </div>
              <Button
                variant="secondary"
                className="self-start tablet:self-auto"
                onClick={() => setUsernameModalOpen(true)}
                disabled={!gymProfile?.username}
              >
                Update Username
              </Button>
            </div>
          </Card>

          {/* Email Section */}
          <Card className="p-6">
            <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Email Address</h3>
                  {gymProfile && !gymProfile.email_verified && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-warning-bg px-2 py-1 text-xs font-medium text-warning">
                      <AlertTriangle
                        className="h-4 w-4 text-warning"
                        strokeWidth={2}
                      />
                      Unverified
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-secondary mt-1">
                  {gymProfile?.email || 'Loading...'}
                </p>
                {gymProfile && !gymProfile.email_verified ? (
                  <div className="mt-2 rounded-sm bg-warning-bg p-3 border border-warning-border">
                    <p className="text-xs text-warning">
                      <strong>Action Required:</strong> Check your inbox at{' '}
                      <strong>{gymProfile.email}</strong> and click the
                      verification link to activate your new email.
                    </p>
                    <p className="text-xs text-warning mt-1 flex items-center gap-1">
                      <Lightbulb
                        className="h-3.5 w-3.5 text-warning"
                        strokeWidth={2}
                      />
                      <strong>Important:</strong> Use this new email for future
                      logins.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted mt-2">
                    Used for login and account recovery
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                className="self-start tablet:self-auto"
                onClick={() => setEmailModalOpen(true)}
                disabled={!gymProfile?.email}
              >
                Update Email
              </Button>
            </div>
          </Card>

          {/* Phone Number Section */}
          <Card className="p-6">
            <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <div>
                <h3 className="text-base font-semibold">Phone Number</h3>
                <p className="text-sm text-ink-secondary mt-1">
                  {maskPhone(gymProfile?.phone_number)}
                </p>
                <p className="text-xs text-ink-muted mt-2">
                  Used for OTP login and SMS notifications
                </p>
              </div>
              <Button
                variant="secondary"
                className="self-start tablet:self-auto"
                onClick={() => setPhoneModalOpen(true)}
              >
                Update Phone
              </Button>
            </div>
          </Card>

          {/* Password Section */}
          <Card className="p-6">
            <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <div>
                <h3 className="text-base font-semibold">Password</h3>
                <p className="text-sm text-ink-secondary mt-1">••••••••</p>
                <p className="text-xs text-ink-muted mt-2">
                  Keep your account secure with a strong password
                </p>
              </div>
              <Button
                variant="secondary"
                className="self-start tablet:self-auto"
                onClick={() => setPasswordModalOpen(true)}
              >
                Change Password
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <UsernameUpdateModal
        open={usernameModalOpen}
        onClose={() => setUsernameModalOpen(false)}
        currentUsername={gymProfile?.username || ''}
      />
      <PasswordChangeModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
      <EmailUpdateModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        currentEmail={gymProfile?.email || ''}
      />
      <PhoneUpdateModal
        open={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        currentPhone={gymProfile?.phone_number || null}
      />
    </div>
  )
}
