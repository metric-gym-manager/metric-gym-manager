import { z } from 'zod';
import { normalizePhoneNumber, isValidSriLankanPhone } from '../utils/phone.utils';

// ============================================================
// REGISTRATION SCHEMA
// ============================================================

export const registrationSchema = z
  .object({
    // Gym information
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

    // Credentials
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must not exceed 50 characters')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain letters, numbers, hyphens, and underscores'
      ),
    email: z.string().email('Must be a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

// ============================================================
// LOGIN SCHEMAS
// ============================================================

// Username or Email + Password
export const loginSchema = z.object({
  usernameOrEmail: z
    .string()
    .min(3, 'Username or email must be at least 3 characters'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Phone OTP - Request OTP (with automatic normalization)
export const phoneOtpRequestSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .transform(normalizePhoneNumber)
    .refine(
      (val) => val !== null && isValidSriLankanPhone(val),
      'Phone number must be a valid Sri Lankan number (e.g., 0771234567 or +94771234567)'
    ),
});

export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>;

// Phone OTP - Verify OTP (with automatic normalization)
export const phoneOtpVerifySchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .transform(normalizePhoneNumber)
    .refine(
      (val) => val !== null && isValidSriLankanPhone(val),
      'Phone number must be a valid Sri Lankan number'
    ),
  otpCode: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^[0-9]+$/, 'OTP must contain only numbers'),
});

export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;

// ============================================================
// FORGOT PASSWORD SCHEMA
// ============================================================

export const forgotPasswordSchema = z.object({
  email: z.string().email('Must be a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ============================================================
// RESET PASSWORD SCHEMA
// ============================================================

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================================
// UPDATE PROFILE SCHEMAS
// ============================================================

export const updateGymInfoSchema = z.object({
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

export type UpdateGymInfoInput = z.infer<typeof updateGymInfoSchema>;

export const updateEmailSchema = z.object({
  newEmail: z.string().email('Must be a valid email address'),
});

export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export const updatePhoneNumberSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .transform(normalizePhoneNumber)
    .refine(
      (val) => val !== null && isValidSriLankanPhone(val),
      'Phone number must be a valid Sri Lankan number'
    ),
  otpCode: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^[0-9]+$/, 'OTP must contain only numbers'),
});

export type UpdatePhoneNumberInput = z.infer<typeof updatePhoneNumberSchema>;
