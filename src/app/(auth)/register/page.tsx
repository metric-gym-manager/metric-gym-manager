'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  MessageCircle,
  Building2,
  User,
  MapPin,
  Globe,
  Check,
  X
} from 'lucide-react';
import { registrationSchema, type RegistrationInput } from '@/features/auth/schemas/auth.schemas';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form data
  const [formData, setFormData] = useState<Partial<RegistrationInput>>({
    gymName: '',
    gymAddress: '',
    gymWebsite: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof RegistrationInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user types
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    setError(null);
  };

  // Password strength checker
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, text: '', color: '' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength, text: 'Weak', color: 'bg-red-500' };
    if (strength === 3) return { strength, text: 'Fair', color: 'bg-yellow-500' };
    if (strength === 4) return { strength, text: 'Good', color: 'bg-blue-500' };
    return { strength, text: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password || '');

  const validateStep1 = (): boolean => {
    const step1Schema = z.object({
      gymName: z
        .string()
        .min(2, 'Gym name must be at least 2 characters')
        .max(100, 'Gym name must not exceed 100 characters'),
      gymAddress: z
        .string()
        .min(5, 'Address must be at least 5 characters')
        .max(200, 'Address must not exceed 200 characters')
        .optional(),
      gymWebsite: z
        .string()
        .url('Must be a valid URL')
        .optional()
        .or(z.literal('')),
    });

    try {
      step1Schema.parse({
        gymName: formData.gymName,
        gymAddress: formData.gymAddress,
        gymWebsite: formData.gymWebsite,
      });
      setFieldErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0].toString()] = error.message;
          }
        });
        setFieldErrors(errors);
      }
      return false;
    }
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      // Validate entire form
      const validatedData = registrationSchema.parse(formData);
      setIsLoading(true);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || 'Registration failed');
        return;
      }

      // Redirect to verify-email page
      router.push(`/verify-email?email=${encodeURIComponent(validatedData.email)}`);
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#ffffff' }}>
      <div className="w-full max-w-[480px] px-6 py-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center mb-12 group">
          <div className="transition-transform duration-200 group-hover:scale-105">
            <Image
              src="/logo.svg"
              alt="Metric Logo"
              width={32}
              height={32}
            />
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
              {/* Header with Progress */}
              <div className="mb-8 text-center">
                <h2
                  className="font-bold mb-2"
                  style={{
                    fontSize: '32px',
                    letterSpacing: '-0.02em',
                    color: '#1d1d1f',
                  }}
                >
                  Create Account
                </h2>
                <p style={{ fontSize: '15px', color: '#6e6e73', marginBottom: '24px' }}>
                  {step === 1 ? 'Tell us about your gym' : 'Set up your credentials'}
                </p>

                {/* Visual Progress Indicator */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: step >= 1 ? '#2563eb' : 'rgba(0, 0, 0, 0.08)',
                        color: step >= 1 ? '#ffffff' : '#6e6e73',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      {step > 1 ? <Check className="h-5 w-5" /> : '1'}
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: step >= 1 ? '#1d1d1f' : '#86868b',
                      }}
                    >
                      Gym Info
                    </span>
                  </div>
                  <div
                    className="flex-1"
                    style={{
                      height: '2px',
                      background: step >= 2 ? '#2563eb' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: step >= 2 ? '#2563eb' : 'rgba(0, 0, 0, 0.08)',
                        color: step >= 2 ? '#ffffff' : '#6e6e73',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      2
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: step >= 2 ? '#1d1d1f' : '#86868b',
                      }}
                    >
                      Account
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded">
                  <p className="font-medium">{error}</p>
                </div>
              )}

              {/* Multi-step Form */}
              <form onSubmit={handleSubmit}>
                {step === 1 ? (
                  <div className="space-y-5">
                    {/* Gym Name */}
                    <div className="space-y-2">
                      <label
                        htmlFor="gymName"
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#1d1d1f',
                          display: 'block',
                        }}
                      >
                        Gym Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          id="gymName"
                          type="text"
                          value={formData.gymName}
                          onChange={(e) => handleInputChange('gymName', e.target.value)}
                          placeholder="Your gym name"
                          className={`pl-10 ${fieldErrors.gymName ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {fieldErrors.gymName && (
                        <p className="text-sm text-red-500">{fieldErrors.gymName}</p>
                      )}
                    </div>

                    {/* Gym Address */}
                    <div className="space-y-2">
                      <label
                        htmlFor="gymAddress"
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#1d1d1f',
                          display: 'block',
                        }}
                      >
                        Gym Address (Optional)
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          id="gymAddress"
                          type="text"
                          value={formData.gymAddress}
                          onChange={(e) => handleInputChange('gymAddress', e.target.value)}
                          placeholder="123 Main Street, City"
                          className={`pl-10 ${fieldErrors.gymAddress ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {fieldErrors.gymAddress && (
                        <p className="text-sm text-red-500">{fieldErrors.gymAddress}</p>
                      )}
                    </div>

                    {/* Gym Website */}
                    <div className="space-y-2">
                      <label
                        htmlFor="gymWebsite"
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#1d1d1f',
                          display: 'block',
                        }}
                      >
                        Gym Website (Optional)
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          id="gymWebsite"
                          type="url"
                          value={formData.gymWebsite}
                          onChange={(e) => handleInputChange('gymWebsite', e.target.value)}
                          placeholder="https://yourwebsite.com"
                          className={`pl-10 ${fieldErrors.gymWebsite ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {fieldErrors.gymWebsite && (
                        <p className="text-sm text-red-500">{fieldErrors.gymWebsite}</p>
                      )}
                    </div>

                    {/* Next Button */}
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white h-11 mt-2"
                    >
                      Continue
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Username */}
                    <div className="space-y-2">
                      <label
                        htmlFor="username"
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#1d1d1f',
                          display: 'block',
                        }}
                      >
                        Username <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          id="username"
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          placeholder="Choose a username"
                          className={`pl-10 ${fieldErrors.username ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {fieldErrors.username && (
                        <p className="text-sm text-red-500">{fieldErrors.username}</p>
                      )}
                      <p style={{ fontSize: '12px', color: '#86868b' }}>
                        Letters, numbers, hyphens, and underscores only
                      </p>
                    </div>

                    {/* Email */}
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
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="your@email.com"
                          className={`pl-10 ${fieldErrors.email ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {fieldErrors.email && (
                        <p className="text-sm text-red-500">{fieldErrors.email}</p>
                      )}
                    </div>

                    {/* Password */}
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
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          placeholder="Create a strong password"
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

                      {/* Password Strength Indicator */}
                      {formData.password && (
                        <div className="space-y-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full ${
                                  level <= passwordStrength.strength
                                    ? passwordStrength.color
                                    : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <p style={{ fontSize: '12px', color: '#6e6e73' }}>
                            Password strength: <span className="font-medium">{passwordStrength.text}</span>
                          </p>
                        </div>
                      )}

                      {/* Password Requirements */}
                      <div className="space-y-1 mt-2" style={{ fontSize: '12px' }}>
                        <div className={`flex items-center gap-1 ${formData.password && formData.password.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}>
                          {formData.password && formData.password.length >= 8 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1 ${formData.password && /[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                          {formData.password && /[A-Z]/.test(formData.password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>One uppercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1 ${formData.password && /[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                          {formData.password && /[a-z]/.test(formData.password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>One lowercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1 ${formData.password && /[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'}`}>
                          {formData.password && /[0-9]/.test(formData.password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>One number</span>
                        </div>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <label
                        htmlFor="confirmPassword"
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#1d1d1f',
                          display: 'block',
                        }}
                      >
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          placeholder="Confirm your password"
                          className={`pl-10 pr-10 ${fieldErrors.confirmPassword ? 'border-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p className="text-sm text-red-500">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>

                    {/* Legal Agreement */}
                    <div className="mt-6 mb-4">
                      <p className="text-xs text-gray-600 text-center">
                        By registering you accept our{' '}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          Privacy Policy
                        </Link>
                        {' '}and{' '}
                        <Link
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          Terms of Service
                        </Link>
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="w-full"
                        disabled={isLoading}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white h-11"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Login Link */}
                <p
                  className="text-center"
                  style={{
                    fontSize: '13px',
                    color: '#6e6e73',
                    marginTop: '24px',
                  }}
                >
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    style={{
                      color: '#2563eb',
                      fontWeight: 500,
                    }}
                  >
                    Sign in
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
                <p style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '12px' }}>
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
    );
  }
