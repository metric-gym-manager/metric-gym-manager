'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { registrationSchema, type RegistrationInput } from '@/features/auth/schemas/auth.schemas';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register Your Gym</CardTitle>
          <CardDescription>
            Step {step} of 2 - {step === 1 ? 'Gym Information' : 'Account Credentials'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {step === 1 ? (
              <>
                {/* Step 1: Gym Information */}
                <div className="space-y-2">
                  <label htmlFor="gymName" className="text-sm font-medium">
                    Gym Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="gymName"
                    type="text"
                    value={formData.gymName}
                    onChange={(e) => handleInputChange('gymName', e.target.value)}
                    placeholder="Enter your gym name"
                    className={fieldErrors.gymName ? 'border-red-500' : ''}
                  />
                  {fieldErrors.gymName && (
                    <p className="text-sm text-red-500">{fieldErrors.gymName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="gymAddress" className="text-sm font-medium">
                    Gym Address
                  </label>
                  <Input
                    id="gymAddress"
                    type="text"
                    value={formData.gymAddress}
                    onChange={(e) => handleInputChange('gymAddress', e.target.value)}
                    placeholder="Enter your gym address"
                    className={fieldErrors.gymAddress ? 'border-red-500' : ''}
                  />
                  {fieldErrors.gymAddress && (
                    <p className="text-sm text-red-500">{fieldErrors.gymAddress}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="gymWebsite" className="text-sm font-medium">
                    Gym Website (Optional)
                  </label>
                  <Input
                    id="gymWebsite"
                    type="url"
                    value={formData.gymWebsite}
                    onChange={(e) => handleInputChange('gymWebsite', e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className={fieldErrors.gymWebsite ? 'border-red-500' : ''}
                  />
                  {fieldErrors.gymWebsite && (
                    <p className="text-sm text-red-500">{fieldErrors.gymWebsite}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Account Credentials */}
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Choose a username"
                    className={fieldErrors.username ? 'border-red-500' : ''}
                  />
                  {fieldErrors.username && (
                    <p className="text-sm text-red-500">{fieldErrors.username}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Letters, numbers, hyphens, and underscores only
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="your@email.com"
                    className={fieldErrors.email ? 'border-red-500' : ''}
                  />
                  {fieldErrors.email && (
                    <p className="text-sm text-red-500">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Create a strong password"
                    className={fieldErrors.password ? 'border-red-500' : ''}
                  />
                  {fieldErrors.password && (
                    <p className="text-sm text-red-500">{fieldErrors.password}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Min 8 characters with uppercase, lowercase, and number
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirm your password"
                    className={fieldErrors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-sm text-red-500">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            {step === 1 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                className="w-full"
              >
                Next Step
              </Button>
            ) : (
              <div className="flex space-x-2 w-full">
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
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </div>
            )}

            <p className="text-sm text-center text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                Login here
              </Link>
            </p>

            <div className="border-t pt-4 mt-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-gray-700">For any assistance, call 0704379967</p>
                <p className="text-sm text-gray-700">සහය අවශ්‍යනම්, 0704379967 අමතන්න</p>
                <p className="text-sm text-gray-700">ஏதேனும் உதவிக்கு, 0704379967 என்ற எண்ணை அழைக்கவும்.</p>
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
