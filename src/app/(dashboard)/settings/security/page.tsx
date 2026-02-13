'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
      setSuccessMessage('Password updated successfully');
      reset();
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
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
      setSuccessMessage(data.message || 'Verification email sent');
      reset();
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 3000);
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
            Enter your new email address. You'll need to verify it before the change takes
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
    // Validate phone number format
    if (!/^\+94[0-9]{9}$/.test(phoneNumber)) {
      setPhoneError('Phone number must be in +94XXXXXXXXX format');
      return;
    }

    requestOtpMutation.mutate(phoneNumber);
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
                  placeholder="+94XXXXXXXXX"
                />
                {phoneError && (
                  <p className="text-sm text-red-600 mt-1">{phoneError}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Format: +94XXXXXXXXX (e.g., +94771234567)
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

        {/* Security Settings */}
        <div className="space-y-4">
          {/* Email Section */}
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Email Address</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {gymProfile?.email || 'Loading...'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Used for login and account recovery
                </p>
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
