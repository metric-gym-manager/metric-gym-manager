'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { useNow } from '@/hooks/useNow';

// localStorage never notifies subscribers — snapshot-only external store
const emptyStoreSubscribe = () => () => {};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lightbulb, Info, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  updatePasswordSchema,
  updateEmailSchema,
  type UpdatePasswordInput,
  type UpdateEmailInput,
} from '@/features/settings/schemas/settings.schemas';

// Username update schema
const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
});

type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>;

// ============================================================
// PASSWORD CHANGE MODAL
// ============================================================

function PasswordChangeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdatePasswordInput) => {
      const response = await fetch('/api/settings/security/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }

      return response.json();
    },
    onSuccess: () => {
      // Store password change timestamp in localStorage for reminder
      localStorage.setItem('password_changed_at', new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] });

      setSuccessMessage('Password updated successfully. Use your new password for future logins.');
      reset();
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 3000);
    },
  });

  const onSubmit = (data: UpdatePasswordInput) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new password
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
              <p className="text-sm text-red-600 mt-1">
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
              <p className="text-sm text-red-600 mt-1">{errors.new_password.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
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
              <p className="text-sm text-red-600 mt-1">
                {errors.confirm_password.message}
              </p>
            )}
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-md bg-green-50 p-3">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {updateMutation.isError && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Failed to update password'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// USERNAME UPDATE MODAL
// ============================================================

function UsernameUpdateModal({
  open,
  onClose,
  currentUsername,
}: {
  open: boolean;
  onClose: () => void;
  currentUsername: string;
}) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateUsernameInput) => {
      const response = await fetch('/api/settings/security/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update username');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] });
      setSuccessMessage('Username updated successfully');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
    },
  });

  const onSubmit = (data: UpdateUsernameInput) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Username</DialogTitle>
          <DialogDescription>
            Choose a new username for your account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Current Username (read-only) */}
          <div>
            <Label>Current Username</Label>
            <Input value={currentUsername} disabled className="bg-gray-50" />
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
              <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              3-50 characters, letters, numbers, hyphens, and underscores only
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-md bg-green-50 p-3">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {updateMutation.isError && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Failed to update username'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Username'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// EMAIL UPDATE MODAL
// ============================================================

function EmailUpdateModal({
  open,
  onClose,
  currentEmail,
}: {
  open: boolean;
  onClose: () => void;
  currentEmail: string;
}) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateEmailInput>({
    resolver: zodResolver(updateEmailSchema),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateEmailInput) => {
      const response = await fetch('/api/settings/security/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update email');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Immediately refresh the profile to show new email with unverified status
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] });

      setSuccessMessage(data.message || 'Verification email sent. Check your inbox to confirm.');
      reset();
      // Don't auto-close - let user read the message and see the updated email
    },
  });

  const onSubmit = (data: UpdateEmailInput) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Email Address</DialogTitle>
          <DialogDescription>
            Enter your new email address. You&apos;ll need to verify it before the change takes
            effect.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Current Email (read-only) */}
          <div>
            <Label>Current Email</Label>
            <Input value={currentEmail} disabled className="bg-gray-50" />
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
              <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-md bg-green-50 p-3">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {updateMutation.isError && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Failed to update email'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Sending...' : 'Send Verification Email'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// PHONE UPDATE MODAL
// ============================================================

function PhoneUpdateModal({
  open,
  onClose,
  currentPhone,
}: {
  open: boolean;
  onClose: () => void;
  currentPhone: string | null;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch('/api/settings/security/phone/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send OTP');
      }

      return response.json();
    },
    onSuccess: () => {
      setPhoneError(null);
      setStep('otp');
    },
    onError: (error: Error) => {
      setPhoneError(error.message);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ phone, otp }: { phone: string; otp: string }) => {
      const response = await fetch('/api/settings/security/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp_code: otp }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify OTP');
      }

      return response.json();
    },
    onSuccess: () => {
      setOtpError(null);
      setSuccessMessage('Phone number updated successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] });
      setTimeout(() => {
        handleClose();
      }, 2000);
    },
    onError: (error: Error) => {
      setOtpError(error.message);
    },
  });

  const handleClose = () => {
    setStep('phone');
    setPhoneNumber('');
    setOtpCode('');
    setPhoneError(null);
    setOtpError(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSendOtp = () => {
    // Normalize phone number (convert 0771234567 to +94771234567)
    let normalizedPhone = phoneNumber.trim();

    // Remove spaces
    normalizedPhone = normalizedPhone.replace(/\s/g, '');

    // Convert local format to international
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+94' + normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+94' + normalizedPhone;
    }

    // Validate format
    if (!/^\+94[0-9]{9}$/.test(normalizedPhone)) {
      setPhoneError('Invalid phone number. Use format: 0771234567');
      return;
    }

    requestOtpMutation.mutate(normalizedPhone);
  };

  const handleVerifyOtp = () => {
    // Validate OTP format
    if (!/^[0-9]{6}$/.test(otpCode)) {
      setOtpError('OTP must be 6 digits');
      return;
    }

    verifyOtpMutation.mutate({ phone: phoneNumber, otp: otpCode });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Phone Number</DialogTitle>
          <DialogDescription>
            {step === 'phone'
              ? 'Enter your new phone number. We will send you a verification code.'
              : 'Enter the 6-digit code sent to your phone.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {step === 'phone' ? (
            <>
              {/* Current Phone (read-only) */}
              <div>
                <Label>Current Phone</Label>
                <Input
                  value={currentPhone || 'Not set'}
                  disabled
                  className="bg-gray-50"
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
                    setPhoneNumber(e.target.value);
                    setPhoneError(null);
                  }}
                  placeholder="0771234567"
                />
                {phoneError && (
                  <p className="text-sm text-red-600 mt-1">{phoneError}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Enter your Sri Lankan mobile number (e.g., 0771234567)
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={requestOtpMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendOtp}
                  disabled={requestOtpMutation.isPending || !phoneNumber}
                >
                  {requestOtpMutation.isPending ? 'Sending...' : 'Send OTP'}
                </Button>
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
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setOtpError(null);
                  }}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
                {otpError && <p className="text-sm text-red-600 mt-1">{otpError}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  Code expires in 10 minutes
                </p>
              </div>

              {/* Success Message */}
              {successMessage && (
                <div className="rounded-md bg-green-50 p-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('phone')}
                  disabled={verifyOtpMutation.isPending}
                >
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => requestOtpMutation.mutate(phoneNumber)}
                    disabled={requestOtpMutation.isPending || verifyOtpMutation.isPending}
                  >
                    Resend OTP
                  </Button>
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={verifyOtpMutation.isPending || !otpCode}
                  >
                    {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN ACCOUNT SECURITY PAGE
// ============================================================

export default function AccountSecurityPage() {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [passwordReminderDismissed, setPasswordReminderDismissed] = useState(false);

  // Fetch current gym profile
  const { data: gymProfile } = useQuery({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const result = await response.json();
      return result.data;
    },
  });

  // Check for recent password change (within last 3 days). Reading the
  // client-only marker through useSyncExternalStore avoids setState-in-effect.
  const passwordChangedAt = useSyncExternalStore(
    emptyStoreSubscribe,
    () => localStorage.getItem('password_changed_at'),
    () => null
  );
  const now = useNow();
  const daysSincePasswordChange = passwordChangedAt
    ? (now - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const showPasswordReminder =
    !passwordReminderDismissed && daysSincePasswordChange < 3;

  // Clean up the marker once the reminder window has passed
  useEffect(() => {
    if (passwordChangedAt && daysSincePasswordChange >= 3) {
      localStorage.removeItem('password_changed_at');
    }
  }, [passwordChangedAt, daysSincePasswordChange]);

  const dismissPasswordReminder = () => {
    setPasswordReminderDismissed(true);
    localStorage.removeItem('password_changed_at');
  };

  const maskPhone = (phone: string | null) => {
    if (!phone) return 'Not set';
    // Mask phone number: +94 XX XXX XXXX
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 11) return phone;
    return `+${cleaned.slice(0, 2)} XX XXX ${cleaned.slice(-4)}`;
  };

  return (
    <div className="max-w-3xl">
      <div className="space-y-6">
        {/* Description */}
        <div>
          <h2 className="text-lg font-semibold">Account Security</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your account security settings including password, email, and phone number
          </p>
        </div>

        {/* Password Change Reminder Banner */}
        {showPasswordReminder && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">
                    Password Recently Updated
                  </h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Your password was recently changed. Please use your new password for future logins.
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    This reminder will be shown for 3 days.
                  </p>
                </div>
              </div>
              <button
                onClick={dismissPasswordReminder}
                className="flex-shrink-0 text-blue-600 hover:text-blue-800"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {/* Security Settings */}
        <div className="space-y-4">
          {/* Username Section */}
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Username</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {gymProfile?.username || 'Loading...'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Your unique identifier displayed in the system
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setUsernameModalOpen(true)}
                disabled={!gymProfile?.username}
              >
                Update Username
              </Button>
            </div>
          </div>

          {/* Email Section */}
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Email Address</h3>
                  {gymProfile && !gymProfile.email_verified && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-blue-600" strokeWidth={2} />
                      Unverified
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {gymProfile?.email || 'Loading...'}
                </p>
                {gymProfile && !gymProfile.email_verified ? (
                  <div className="mt-2 rounded-md bg-amber-50 p-3 border border-amber-200">
                    <p className="text-xs text-amber-800">
                      <strong>Action Required:</strong> Check your inbox at <strong>{gymProfile.email}</strong> and click the verification link to activate your new email.
                    </p>
                    <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <Lightbulb className="h-3.5 w-3.5 text-blue-600" strokeWidth={2} />
                      <strong>Important:</strong> Use this new email for future logins.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">
                    Used for login and account recovery
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setEmailModalOpen(true)}
                disabled={!gymProfile?.email}
              >
                Update Email
              </Button>
            </div>
          </div>

          {/* Phone Number Section */}
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Phone Number</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {maskPhone(gymProfile?.phone_number)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Used for OTP login and SMS notifications
                </p>
              </div>
              <Button variant="outline" onClick={() => setPhoneModalOpen(true)}>
                Update Phone
              </Button>
            </div>
          </div>

          {/* Password Section */}
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Password</h3>
                <p className="text-sm text-gray-600 mt-1">••••••••</p>
                <p className="text-xs text-gray-500 mt-2">
                  Keep your account secure with a strong password
                </p>
              </div>
              <Button variant="outline" onClick={() => setPasswordModalOpen(true)}>
                Change Password
              </Button>
            </div>
          </div>
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
  );
}
