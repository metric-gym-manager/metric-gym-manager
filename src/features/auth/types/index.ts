import type { User as SupabaseUser } from '@supabase/supabase-js';

// ============================================================
// AUTH USER TYPES
// ============================================================

export interface AuthUser extends SupabaseUser {
  email: string;
}

export interface GymProfile {
  id: string;
  username: string;
  email: string;
  email_verified: boolean;
  phone_number: string | null;
  gym_name: string;
  gym_address: string | null;
  gym_website: string | null;
  profile_image_url: string | null;
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

