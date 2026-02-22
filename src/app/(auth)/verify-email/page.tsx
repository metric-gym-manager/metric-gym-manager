'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying your email...');
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(15);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      const emailParam = searchParams.get('email');

      // Set email from URL if provided
      if (emailParam) {
        setEmail(emailParam);
      }

      if (type === 'signup') {
        // Handle email verification from Supabase
        // This will be handled by Supabase's email confirmation
        setStatus('success');
        setMessage(
          'Email verification successful! You can now log in to your account.'
        );
        return;
      }

      // Handle email change verification
      if (type === 'email_change' || type === 'email') {
        // Get token_hash from URL (Supabase sends this)
        const tokenHash = searchParams.get('token_hash') || token;

        if (!tokenHash) {
          setStatus('error');
          setMessage('Invalid verification link. No token provided.');
          return;
        }

        try {
          setStatus('pending');
          setMessage('Verifying your email address...');

          const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenHash }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            setStatus('success');
            setMessage('Email verified successfully! Please log in with your new email address.');

            // Log out the user so they can log in with new email
            await fetch('/api/auth/logout', { method: 'POST' });

            // Auto-redirect to login after 5 seconds
            setTimeout(() => {
              router.push('/login');
            }, 5000);
          } else {
            setStatus('error');
            setMessage(data.error || 'Failed to verify email. The link may be expired or invalid.');
          }
        } catch (error) {
          setStatus('error');
          setMessage('An unexpected error occurred while verifying your email.');
        }
        return;
      }

      // No specific type or token, show instructions
      if (!token) {
        setStatus('pending');
        setMessage(
          'Please check your email for a verification link. Click the link in the email to verify your account.'
        );
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  const handleResendEmail = async () => {
    if (!email || email.trim() === '') {
      setResendMessage('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setResendMessage('Please enter a valid email address');
      return;
    }

    setIsResending(true);
    setResendMessage(null);

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        setResendMessage('Verification email sent! Please check your inbox and spam folder.');
        setResendCooldown(15); // Reset cooldown timer
      } else {
        setResendMessage(result.error || 'Failed to resend email');
      }
    } catch (error) {
      setResendMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {status === 'pending' && 'Verify your email to continue'}
            {status === 'success' && 'Email verified successfully'}
            {status === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-300 text-yellow-900 px-4 py-3 rounded">
              <p className="text-sm font-medium">
                ⚠️ Verify your email to log in — check your inbox (including the spam folder)
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              <p className="font-medium mb-2">Email verified successfully!</p>
              <p className="text-sm">
                Please{' '}
                <button
                  onClick={() => router.push('/login')}
                  className="underline font-medium hover:text-green-800"
                >
                  log in
                </button>{' '}
                with your new email address.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p className="font-medium mb-2">Verification Failed</p>
              <p className="text-sm">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <p className="text-xs text-gray-500 text-center">
              You will be redirected to the login page automatically in 5 seconds...
            </p>
          )}

          {status === 'pending' && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Didn&apos;t receive the email?
              </p>
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || !email || resendCooldown > 0}
                  variant="outline"
                  className="w-full"
                >
                  {isResending
                    ? 'Sending...'
                    : resendCooldown > 0
                    ? `Resend Verification Email (${resendCooldown}s)`
                    : 'Resend Verification Email'}
                </Button>
                {resendMessage && (
                  <p className={`text-sm ${resendMessage.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>
                    {resendMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          {status === 'success' ? (
            <Button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Go to Login
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Back to Login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
