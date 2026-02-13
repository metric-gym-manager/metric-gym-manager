import type { User as SupabaseUser } from '@supabase/supabase-js';

// ============================================================
// AUTH USER TYPES
// ============================================================

export interface AuthUser extends SupabaseUser {
  email: string;
}

export interface GymProfile {
  id: string;
  user_id: string;
  username: string;
  email: string;
  email_verified: boolean;
  phone_number: string | null;
  gym_name: string;
  gym_address: string | null;
  gym_website: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionData {
  user: AuthUser;
  gymProfile: GymProfile;
}

// ============================================================
// AUTH RESPONSE TYPES
// ============================================================

export interface AuthResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  user: AuthUser;
  gymProfile: GymProfile;
  requiresEmailVerification?: boolean;
}

export interface RegistrationResponse {
  user: AuthUser;
  requiresEmailVerification: boolean;
  message: string;
}

export interface OtpResponse {
  success: boolean;
  message: string;
  expiresAt?: string;
}

// ============================================================
// OTP TOKEN TYPES
// ============================================================

export interface OtpToken {
  id: string;
  phone_number: string;
  otp_code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

// ============================================================
// SESSION DURATION
// ============================================================

export const SESSION_DURATION = {
  DEFAULT: 24 * 60 * 60, // 24 hours in seconds
  REMEMBER_ME: 30 * 24 * 60 * 60, // 30 days in seconds
} as const;
