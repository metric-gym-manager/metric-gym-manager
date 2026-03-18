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
  CheckCircle,
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
            Start Your Free Trial
          </h2>
          <p className="text-xl text-white/90 mb-12">
            Join 25+ gyms that trust Metric to manage their operations. Get started in minutes, no credit card required.
          </p>

          {/* Features */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-lg">Setup in under 5 minutes</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-lg">No credit card required</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-lg">30-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-lg">Free onboarding support</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-white/75 text-sm">
          <p>© 2026 Metric Gym Manager. Built with ❤️ in Sri Lanka 🇱🇰</p>
        </div>
      </div>

      {/* Right Side - Registration Form */}
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
              {/* Header with Progress */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
                <p className="text-gray-300 mb-6">
                  {step === 1 ? 'Tell us about your gym' : 'Set up your credentials'}
                </p>

                {/* Visual Progress Indicator */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? 'bg-brand-accent text-white' : 'bg-gray-700 text-gray-300'}`}>
                      {step > 1 ? <Check className="h-5 w-5" /> : '1'}
                    </div>
                    <span className={`text-sm font-medium ${step >= 1 ? 'text-white' : 'text-gray-400'}`}>
                      Gym Info
                    </span>
                  </div>
                  <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-brand-accent' : 'bg-gray-700'}`}></div>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? 'bg-brand-accent text-white' : 'bg-gray-700 text-gray-300'}`}>
                      2
                    </div>
                    <span className={`text-sm font-medium ${step >= 2 ? 'text-white' : 'text-gray-400'}`}>
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
                      <label htmlFor="gymName" className="text-sm font-medium text-white">
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
                      <label htmlFor="gymAddress" className="text-sm font-medium text-white">
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
                      <label htmlFor="gymWebsite" className="text-sm font-medium text-white">
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
                      <label htmlFor="username" className="text-sm font-medium text-white">
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
                      <p className="text-xs text-gray-400">
                        Letters, numbers, hyphens, and underscores only
                      </p>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium text-white">
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
                      <label htmlFor="password" className="text-sm font-medium text-white">
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
                          <p className="text-xs text-gray-300">
                            Password strength: <span className="font-medium">{passwordStrength.text}</span>
                          </p>
                        </div>
                      )}

                      {/* Password Requirements */}
                      <div className="text-xs space-y-1 mt-2">
                        <div className={`flex items-center gap-1 ${formData.password && formData.password.length >= 8 ? 'text-green-400' : 'text-gray-400'}`}>
                          {formData.password && formData.password.length >= 8 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1 ${formData.password && /[A-Z]/.test(formData.password) ? 'text-green-400' : 'text-gray-400'}`}>
                          {formData.password && /[A-Z]/.test(formData.password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>One uppercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1 ${formData.password && /[a-z]/.test(formData.password) ? 'text-green-400' : 'text-gray-400'}`}>
                          {formData.password && /[a-z]/.test(formData.password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>One lowercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1 ${formData.password && /[0-9]/.test(formData.password) ? 'text-green-400' : 'text-gray-400'}`}>
                          {formData.password && /[0-9]/.test(formData.password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>One number</span>
                        </div>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="text-sm font-medium text-white">
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

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-6">
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
                <p className="text-sm text-center text-gray-300 mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-brand-accent hover:text-brand-accent/80 font-medium">
                    Sign in
                  </Link>
                </p>
              </form>

              {/* Support Section */}
              <div className="mt-8 pt-6 border-t border-gray-700">
                <div className="text-center">
                  <p className="text-sm text-gray-300 mb-3">Need help?</p>
                  <div className="flex justify-center gap-4">
                    <a
                      href="tel:0704379967"
                      className="flex items-center gap-2 text-sm text-white hover:text-brand-accent transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      <span>0704379967</span>
                    </a>
                    <a
                      href="https://wa.me/94704379967"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white hover:text-brand-accent transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-400">සහය අවශ්‍යනම්, 0704379967 අමතන්න</p>
                    <p className="text-xs text-gray-400">ஏதேனும் உதவிக்கு, 0704379967 அழைக்கவும்</p>
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
