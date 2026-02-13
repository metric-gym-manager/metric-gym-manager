'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  loginSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  type LoginInput,
} from '@/features/auth/schemas/auth.schemas';

type AuthMethod = 'password' | 'otp';

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: 'Email verification link is invalid. Please try registering again.',
  verification_failed: 'Email verification failed. The link may have expired.',
  incomplete_registration: 'Registration data is incomplete. Please register again.',
  profile_creation_failed: 'Failed to create your profile. Please contact support.',
  username_taken: 'Username was taken by another user during verification. Please register with a different username.',
  unexpected_error: 'An unexpected error occurred. Please try again.',
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle errors from URL parameters (e.g., email verification failures)
  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode]);
    }
  }, [searchParams]);

  // Password auth form
  const [passwordForm, setPasswordForm] = useState<Partial<LoginInput>>({
    usernameOrEmail: '',
    password: '',
    rememberMe: false,
  });

  // OTP auth form
  const [otpForm, setOtpForm] = useState({
    phoneNumber: '',
    otpCode: '',
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Countdown timer for OTP
  useEffect(() => {
    if (!otpExpiry) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((otpExpiry.getTime() - now.getTime()) / 1000));
      setCountdown(diff);

      if (diff === 0) {
        setOtpSent(false);
        setOtpExpiry(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [otpExpiry]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      const validatedData = loginSchema.parse(passwordForm);
      setIsLoading(true);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Login failed');
        return;
      }

      // Redirect to dashboard
      router.push('/dashboard/members');
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0].toString()] = error.message;
          }
        });
        setFieldErrors(errors);
        setError('Please fix the errors below');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError(null);
    setFieldErrors({});

    try {
      const validatedData = phoneOtpRequestSchema.parse({
        phoneNumber: otpForm.phoneNumber,
      });
      setIsLoading(true);

      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to send OTP');
        return;
      }

      setOtpSent(true);
      setOtpExpiry(new Date(result.data.expiresAt));
      setSuccess('OTP sent successfully! Check your phone.');
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0].toString()] = error.message;
          }
        });
        setFieldErrors(errors);
        setError('Invalid phone number format');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      const validatedData = phoneOtpVerifySchema.parse(otpForm);
      setIsLoading(true);

      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Invalid OTP');
        return;
      }

      // Redirect to dashboard
      router.push('/dashboard/members');
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0].toString()] = error.message;
          }
        });
        setFieldErrors(errors);
        setError('Please fix the errors below');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login to Your Account</CardTitle>
          <CardDescription>
            Choose your preferred login method
          </CardDescription>

          {/* Auth method toggle */}
          <div className="flex space-x-2 mt-4">
            <Button
              type="button"
              variant={authMethod === 'password' ? 'default' : 'outline'}
              onClick={() => {
                setAuthMethod('password');
                setError(null);
                setSuccess(null);
                setFieldErrors({});
              }}
              className="flex-1"
            >
              Username/Email
            </Button>
            <Button
              type="button"
              variant={authMethod === 'otp' ? 'default' : 'outline'}
              onClick={() => {
                setAuthMethod('otp');
                setError(null);
                setSuccess(null);
                setFieldErrors({});
              }}
              className="flex-1"
            >
              Phone OTP
            </Button>
          </div>
        </CardHeader>

        {authMethod === 'password' ? (
          <form onSubmit={handlePasswordLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="usernameOrEmail" className="text-sm font-medium">
                  Username or Email
                </label>
                <Input
                  id="usernameOrEmail"
                  type="text"
                  value={passwordForm.usernameOrEmail}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, usernameOrEmail: e.target.value });
                    setError(null);
                  }}
                  placeholder="Enter username or email"
                  className={fieldErrors.usernameOrEmail ? 'border-red-500' : ''}
                />
                {fieldErrors.usernameOrEmail && (
                  <p className="text-sm text-red-500">{fieldErrors.usernameOrEmail}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, password: e.target.value });
                    setError(null);
                  }}
                  placeholder="Enter your password"
                  className={fieldErrors.password ? 'border-red-500' : ''}
                />
                {fieldErrors.password && (
                  <p className="text-sm text-red-500">{fieldErrors.password}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={passwordForm.rememberMe}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, rememberMe: e.target.checked })
                  }
                  className="rounded"
                />
                <label htmlFor="rememberMe" className="text-sm">
                  Remember me (30 days)
                </label>
              </div>

              <div className="text-right">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>

              <p className="text-sm text-center text-gray-600">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-blue-600 hover:underline">
                  Register here
                </Link>
              </p>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="phoneNumber" className="text-sm font-medium">
                  Phone Number
                </label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={otpForm.phoneNumber}
                  onChange={(e) => {
                    setOtpForm({ ...otpForm, phoneNumber: e.target.value });
                    setError(null);
                    setSuccess(null);
                  }}
                  placeholder="+94XXXXXXXXX"
                  className={fieldErrors.phoneNumber ? 'border-red-500' : ''}
                  disabled={otpSent}
                />
                {fieldErrors.phoneNumber && (
                  <p className="text-sm text-red-500">{fieldErrors.phoneNumber}</p>
                )}
                <p className="text-xs text-gray-500">
                  Format: +94 followed by 9 digits
                </p>
              </div>

              {!otpSent ? (
                <Button
                  type="button"
                  onClick={handleRequestOtp}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="otpCode" className="text-sm font-medium">
                        OTP Code
                      </label>
                      {countdown > 0 && (
                        <Badge variant="secondary">Expires in {countdown}s</Badge>
                      )}
                    </div>
                    <Input
                      id="otpCode"
                      type="text"
                      maxLength={6}
                      value={otpForm.otpCode}
                      onChange={(e) => {
                        setOtpForm({ ...otpForm, otpCode: e.target.value.replace(/\D/g, '') });
                        setError(null);
                      }}
                      placeholder="Enter 6-digit OTP"
                      className={fieldErrors.otpCode ? 'border-red-500' : ''}
                    />
                    {fieldErrors.otpCode && (
                      <p className="text-sm text-red-500">{fieldErrors.otpCode}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify OTP'}
                  </Button>

                  {countdown === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpForm({ ...otpForm, otpCode: '' });
                        setSuccess(null);
                      }}
                      className="w-full"
                    >
                      Resend OTP
                    </Button>
                  )}
                </>
              )}
            </CardContent>

            {!otpSent && (
              <CardFooter className="flex flex-col space-y-4">
                <p className="text-sm text-center text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="text-blue-600 hover:underline">
                    Register here
                  </Link>
                </p>
              </CardFooter>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
