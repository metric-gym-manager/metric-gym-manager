'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Lock, Eye, EyeOff, CheckCircle, Phone, MessageCircle } from 'lucide-react';

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
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Handle errors from URL parameters (e.g., email verification failures)
  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode]);
    }
  }, [searchParams]);

  // Login form
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    rememberMe: true,
  });

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setShowResendVerification(false);

    try {
      // Simple validation
      const emailSchema = z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(1, 'Password is required'),
        rememberMe: z.boolean().optional(),
      });

      const validatedData = emailSchema.parse(loginForm);
      setIsLoading(true);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Login failed');

        // Show resend verification option if email verification is required
        if (result.errorCode === 'email_verification_required') {
          setShowResendVerification(true);
          setResendEmail(validatedData.email);
        }
        return;
      }

      // Clear React Query cache to ensure fresh data for new session
      queryClient.clear();

      // Redirect to dashboard
      router.push('/members');
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

  const handleResendVerification = async () => {
    if (!resendEmail) {
      setError('Please enter your email address to resend verification');
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Verification email sent! Please check your inbox and spam folder.');
        setShowResendVerification(false);
      } else {
        setError(result.error || 'Failed to resend verification email');
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding & Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-accent via-indigo-600 to-purple-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 bg-white px-4 py-3 rounded-lg shadow-lg">
            <Image
              src="/logo.svg"
              alt="Metric Gym Manager Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <h1 className="text-2xl font-bold text-gray-900">Metric Gym Manager</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 text-white">
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Welcome Back!
          </h2>
          <p className="text-xl text-white/90 mb-12">
            Manage your gym with confidence. All your members, payments, and analytics in one place.
          </p>

          {/* Trust Indicators */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-lg">25+ gyms trust Metric</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-lg">2.2K+ active members</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-lg">99.99% uptime guarantee</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-white/75 text-sm">
          <p>© 2026 Metric Gym Manager. Built with ❤️ in Sri Lanka 🇱🇰</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <h1 className="text-xl font-bold text-gray-900">Metric Gym Manager</h1>
          </div>

          <Card className="border-none shadow-xl">
            <CardContent className="pt-8 pb-8">
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h2>
                <p className="text-gray-600">Welcome back! Please enter your details.</p>
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
                  <p className="text-sm">Please enter your email to resend the verification link:</p>
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
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => {
                        setLoginForm({ ...loginForm, email: e.target.value });
                        setError(null);
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
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(e) => {
                        setLoginForm({ ...loginForm, password: e.target.value });
                        setError(null);
                      }}
                      placeholder="Enter your password"
                      className={`pl-10 pr-10 ${fieldErrors.password ? 'border-red-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                        setLoginForm({ ...loginForm, rememberMe: e.target.checked })
                      }
                      className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
                    />
                    <label htmlFor="rememberMe" className="text-sm text-gray-700">
                      Remember me
                    </label>
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-brand-accent hover:text-brand-accent/80 font-medium"
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
                <p className="text-sm text-center text-gray-600">
                  Don't have an account?{' '}
                  <Link href="/register" className="text-brand-accent hover:text-brand-accent/80 font-medium">
                    Sign up for free
                  </Link>
                </p>
              </form>

              {/* Support Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">Need help?</p>
                  <div className="flex justify-center gap-4">
                    <a
                      href="tel:0704379967"
                      className="flex items-center gap-2 text-sm text-gray-700 hover:text-brand-accent transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      <span>0704379967</span>
                    </a>
                    <a
                      href="https://wa.me/94704379967"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-700 hover:text-brand-accent transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-500">සහය අවශ්‍යනම්, 0704379967 අමතන්න</p>
                    <p className="text-xs text-gray-500">ஏதேனும் உதவிக்கு, 0704379967 அழைக்கவும்</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
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
  );
}
