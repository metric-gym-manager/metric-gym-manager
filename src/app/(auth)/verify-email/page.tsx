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

  useEffect(() => {
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
    } else if (!token) {
      // No token, show instructions
      setStatus('pending');
      setMessage(
        'Please check your email for a verification link. Click the link in the email to verify your account.'
      );
    }
  }, [searchParams]);

  const handleResendEmail = async () => {
    if (!email) {
      setResendMessage('Please enter your email address');
      return;
    }

    setIsResending(true);
    setResendMessage(null);

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        setResendMessage('Verification email sent! Please check your inbox.');
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
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
              <p className="font-medium mb-2">Check Your Inbox</p>
              <p className="text-sm">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              <p className="font-medium mb-2">Verification Successful!</p>
              <p className="text-sm">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p className="font-medium mb-2">Verification Failed</p>
              <p className="text-sm">{message}</p>
            </div>
          )}

          <div className="space-y-2 text-sm text-gray-600">
            <p className="font-medium">What to do next:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your email inbox (including spam/junk folder)</li>
              <li>Click the verification link in the email</li>
              <li>Return to this page or log in</li>
            </ul>
          </div>

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
                  disabled={isResending || !email}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? 'Sending...' : 'Resend Verification Email'}
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
