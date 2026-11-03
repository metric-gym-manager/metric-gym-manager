'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useNow } from '@/hooks/useNow'

// localStorage never notifies subscribers — snapshot-only external store
const emptyStoreSubscribe = () => () => {}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info, X } from 'lucide-react'
import { Badge, Modal, Button, Input, Label } from '@/components/ui'
import { SettingsSection, SettingsRow } from '@/components/common/composites'
import {
  updatePasswordSchema,
  updateEmailSchema,
  updateGymPhoneSchema,
  type UpdatePasswordInput,
  type UpdateEmailInput,
} from '@/features/settings/schemas/settings.schemas'
import { parseApiError } from '@/utils/api-error'

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
      placement="sheet"
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
      placement="sheet"
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

      // Fallback asserts a REQUEST, not a delivery. The previous wording
      // ("Verification email sent") claimed something neither this component
      // nor the server can observe: `updateUser` returns once the change is
      // recorded, and the SMTP send happens afterwards. The server now sends
      // its own honest message; this only covers a response that omits one.
      setSuccessMessage(
        data.message ||
          'Change requested. Confirmation links are on their way to both addresses.'
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
      placement="sheet"
      title="Update Email Address"
      description="For your security, a confirmation link goes to BOTH your current and your new address. The change takes effect only once both are confirmed \u2014 so nobody who gains access to your account can move it to an address you don't control."
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
              : 'Send Confirmation Links'}
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
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // One step: the signed-in session is the proof that this is the owner. The
  // two-step "send a code, enter the code" flow this replaced called two
  // endpoints that never existed, so every attempt failed.
  const updateMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch('/api/settings/security/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      return response.json()
    },
    onSuccess: () => {
      setPhoneError(null)
      setSuccessMessage('Phone number updated successfully')
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] })
      setTimeout(() => {
        handleClose()
      }, 2000)
    },
    onError: (error: Error) => {
      setPhoneError(error.message)
    },
  })

  const handleClose = () => {
    setPhoneNumber('')
    setPhoneError(null)
    setSuccessMessage(null)
    onClose()
  }

  const handleSave = () => {
    // The schema the route validates with, so the number sent is already the
    // stored +94 form and a malformed one never leaves the browser.
    const parsed = updateGymPhoneSchema.safeParse({ phone_number: phoneNumber })
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0].message)
      return
    }
    updateMutation.mutate(parsed.data.phone_number)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
      size="md"
      placement="sheet"
      title="Update Phone Number"
      description="Enter the mobile number you want on your account."
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handleSave}
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending || !phoneNumber}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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

        {/* Success Message */}
        {successMessage && (
          <div className="rounded-sm bg-success-bg p-3">
            <p className="text-sm text-success">{successMessage}</p>
          </div>
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

        {/* Security Settings — §5.18: one labelled section over hairline
            separated rows, not four stacked cards. Each row is the same shape
            (identity, current value, action), which is what makes it a table
            of settings rather than four independent objects. */}
        <SettingsSection
          title="Account security"
          description="Identity, contact details and sign-in credentials"
        >
          <SettingsRow
            label="Username"
            description="Your unique identifier displayed in the system"
            control={
              <div className="flex items-center gap-4">
                <span className="font-mono text-mono-md text-ink-secondary">
                  {gymProfile?.username || 'Loading...'}
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setUsernameModalOpen(true)}
                  disabled={!gymProfile?.username}
                >
                  Update
                </Button>
              </div>
            }
          />

          <SettingsRow
            label={
              <span className="flex items-center gap-2">
                Email address
                {gymProfile &&
                  (gymProfile.pending_email &&
                  gymProfile.pending_email !== gymProfile.email ? (
                    // A change in flight is not the same as an unverified
                    // account: the address on file is confirmed and usable, a
                    // different one is waiting.
                    <Badge variant="warning">Change pending</Badge>
                  ) : (
                    !gymProfile.email_verified && (
                      <Badge variant="warning">Unverified</Badge>
                    )
                  ))}
              </span>
            }
            description={
              gymProfile &&
              (gymProfile.pending_email || !gymProfile.email_verified) ? (
                <>
                  <strong className="text-warning">Action required:</strong>{' '}
                  {gymProfile.pending_email &&
                  gymProfile.pending_email !== gymProfile.email ? (
                    <>
                      this change is confirmed from <strong>both</strong>{' '}
                      addresses. Open the link sent to your current address,{' '}
                      <strong>{gymProfile.email}</strong>, and the one sent to{' '}
                      <strong>{gymProfile.pending_email}</strong>. It takes
                      effect only once both are done — which is what stops
                      someone else moving your account to an address you do not
                      control.
                    </>
                  ) : (
                    <>
                      open the link sent to <strong>{gymProfile.email}</strong>{' '}
                      to confirm this address.
                    </>
                  )}
                </>
              ) : (
                'Used for login and account recovery'
              )
            }
            control={
              <div className="flex items-center gap-4">
                <span className="font-mono text-mono-md text-ink-secondary">
                  {gymProfile?.email || 'Loading...'}
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setEmailModalOpen(true)}
                  disabled={!gymProfile?.email}
                >
                  Update
                </Button>
              </div>
            }
          />

          <SettingsRow
            label="Phone number"
            description="Used for billing and support"
            control={
              <div className="flex items-center gap-4">
                <span className="font-mono text-mono-md text-ink-secondary">
                  {maskPhone(gymProfile?.phone_number)}
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setPhoneModalOpen(true)}
                >
                  Update
                </Button>
              </div>
            }
          />

          <SettingsRow
            label="Password"
            description="Keep your account secure with a strong password"
            control={
              <div className="flex items-center gap-4">
                <span className="font-mono text-mono-md text-ink-secondary">
                  ••••••••
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setPasswordModalOpen(true)}
                >
                  Change
                </Button>
              </div>
            }
          />
        </SettingsSection>
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
