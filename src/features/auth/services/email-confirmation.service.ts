/**
 * Email Confirmation Service
 *
 * Provides custom email confirmation tracking beyond Supabase's default verification.
 * Logs all confirmation attempts for audit trails and better user experience.
 *
 * @module email-confirmation.service
 */

import { createClient } from '@/lib/supabase/server';
import type { AuthResponse } from '../types';

/**
 * Logs an email confirmation sent to a user
 *
 * Called during registration to track when verification emails are sent.
 * Creates a record in the email_confirmations table for auditing.
 *
 * @param userId - Supabase auth.users ID
 * @param gymId - Gym profile ID
 * @param email - Email address where confirmation was sent
 * @param tokenHash - SHA-256 hash of the confirmation token
 *
 * @example
 * const tokenHash = crypto.createHash('sha256')
 *   .update(user.id + user.email + Date.now())
 *   .digest('hex');
 * await logEmailConfirmationSent(user.id, gym.id, user.email, tokenHash);
 */
export async function logEmailConfirmationSent(
  userId: string,
  gymId: string,
  email: string,
  tokenHash: string
): Promise<void> {
  try {
    const supabase = await createClient();

    // Email confirmations expire after 24 hours (standard practice)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await supabase.from('email_confirmations').insert({
      gym_id: gymId,
      user_id: userId,
      email,
      token: tokenHash,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      // Optional: Could add ip_address and user_agent for security auditing
    });
  } catch (error) {
    // Log error but don't fail the registration process
    console.error('Failed to log email confirmation:', error);
  }
}

/**
 * Marks an email confirmation as confirmed
 *
 * Called when a user clicks the verification link and successfully confirms their email.
 * Updates both the email_confirmations table and the gyms table.
 *
 * @param userId - Supabase auth.users ID
 * @returns AuthResponse indicating success or failure
 *
 * @example
 * const result = await markEmailConfirmed(user.id);
 * if (result.success) {
 *   console.log('Email confirmed successfully');
 * }
 */
export async function markEmailConfirmed(
  userId: string
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient();

    // Update email_confirmations table
    const { error: confError } = await supabase
      .from('email_confirmations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'pending'); // Only update pending confirmations

    if (confError) {
      console.error('Failed to update email confirmation:', confError);
      // Continue anyway - don't fail the process
    }

    // Update gyms table to mark email as verified
    const { error: gymError } = await supabase
      .from('gyms')
      .update({
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (gymError) {
      console.error('Failed to update gym email verification:', gymError);
      return {
        success: false,
        error: 'Failed to verify email',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Mark email confirmed error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Resends an email confirmation
 *
 * Triggers Supabase to resend the verification email.
 * Useful when users don't receive the initial email or it expires.
 *
 * @param email - Email address to resend confirmation to
 * @returns AuthResponse indicating success or failure
 *
 * @example
 * const result = await resendEmailConfirmation('user@example.com');
 * if (result.success) {
 *   console.log('Confirmation email resent');
 * }
 */
export async function resendEmailConfirmation(
  email: string
): Promise<AuthResponse<void>> {
  try {
    const supabase = await createClient();

    // Use Supabase's built-in resend functionality
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error('Failed to resend confirmation email:', error);
      return {
        success: false,
        error: 'Failed to resend confirmation email',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Resend email confirmation error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Gets email confirmation status for a user
 *
 * Retrieves the latest email confirmation record for auditing or display.
 *
 * @param userId - Supabase auth.users ID
 * @returns Email confirmation record or null if none exists
 */
export async function getEmailConfirmationStatus(
  userId: string
): Promise<{
  status: 'pending' | 'confirmed' | 'expired';
  sentAt: string;
  confirmedAt?: string;
  expiresAt: string;
} | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('email_confirmations')
      .select('status, sent_at, confirmed_at, expires_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      status: data.status as 'pending' | 'confirmed' | 'expired',
      sentAt: data.sent_at,
      confirmedAt: data.confirmed_at || undefined,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    console.error('Get email confirmation status error:', error);
    return null;
  }
}
