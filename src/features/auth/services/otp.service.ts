import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcrypt';
import type { AuthResponse, AuthUser, GymProfile, OtpResponse } from '../types';
import { sendSmsViaTextLk } from '@/features/sms/services/textlk.service';

// ============================================================
// CONSTANTS
// ============================================================

const OTP_EXPIRY_SECONDS = 600; // 10 minutes (improved from 60 seconds for better UX)
const OTP_RATE_LIMIT_PER_HOUR = 3; // Maximum 3 OTP requests per phone per hour
const BCRYPT_SALT_ROUNDS = 10; // bcrypt salt rounds for OTP hashing

// ============================================================
// GENERATE OTP CODE
// ============================================================

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================
// REQUEST OTP
// ============================================================

export async function requestOtp(
  phoneNumber: string
): Promise<AuthResponse<OtpResponse>> {
  try {
    const supabase = await createClient();

    // Check rate limit (max 3 requests per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentAttempts, error: rateLimitError } = await supabase
      .from('otp_tokens')
      .select('id')
      .eq('phone_number', phoneNumber)
      .gte('created_at', oneHourAgo);

    if (rateLimitError) {
      return {
        success: false,
        error: 'Failed to verify rate limit',
      };
    }

    if (recentAttempts && recentAttempts.length >= OTP_RATE_LIMIT_PER_HOUR) {
      return {
        success: false,
        error: 'Too many OTP requests. Please try again later.',
      };
    }

    // Check if phone number exists in gyms table
    const { data: gym } = await supabase
      .from('gyms')
      .select('id, user_id')
      .eq('phone_number', phoneNumber)
      .single();

    if (!gym) {
      return {
        success: false,
        error: 'Phone number not registered',
      };
    }

    // Generate OTP code
    const otpCode = generateOtpCode();

    // Hash OTP code with bcrypt for security (CRITICAL: Never store plain text OTPs)
    const hashedOtp = await bcrypt.hash(otpCode, BCRYPT_SALT_ROUNDS);

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_SECONDS * 1000
    ).toISOString();

    // Store HASHED OTP in database (not plain text)
    const { error: insertError } = await supabase.from('otp_tokens').insert({
      phone_number: phoneNumber,
      otp_code: hashedOtp, // Bcrypt hashed (60 chars)
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      return {
        success: false,
        error: 'Failed to generate OTP',
      };
    }

    // Send OTP via SMS (real or mock based on feature flag)
    const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

    if (useRealSms) {
      const result = await sendSmsViaTextLk({
        to: phoneNumber,
        message: `Your verification code is: ${otpCode}. Valid for 10 minutes.`,
      });

      if (!result.success) {
        console.error('Failed to send OTP SMS via text.lk:', result.error);
        // Don't fail the OTP generation if SMS fails - user can still try again
      } else {
        console.log(`✓ OTP sent via text.lk (ID: ${result.message_id})`);
      }
    } else {
      console.log(`[MOCK SMS] OTP for ${phoneNumber}: ${otpCode}`);
    }

    return {
      success: true,
      data: {
        success: true,
        message: 'OTP sent successfully',
        expiresAt,
      },
    };
  } catch (error) {
    console.error('Request OTP error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// ============================================================
// VERIFY OTP AND LOGIN
// ============================================================

export async function verifyOtpAndLogin(
  phoneNumber: string,
  otpCode: string
): Promise<
  AuthResponse<{
    user: AuthUser;
    gymProfile: GymProfile;
  }>
> {
  try {
    const supabase = await createClient();

    // Find all valid (unused, unexpired) OTP tokens for this phone
    // We need to fetch all to compare hashes (can't query by hash)
    const { data: otpTokens, error: otpError } = await supabase
      .from('otp_tokens')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (otpError || !otpTokens || otpTokens.length === 0) {
      return {
        success: false,
        error: 'Invalid or expired OTP',
      };
    }

    // Find matching OTP by comparing hashed values
    let matchedToken = null;
    for (const token of otpTokens) {
      const isMatch = await bcrypt.compare(otpCode, token.otp_code);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      return {
        success: false,
        error: 'Invalid or expired OTP',
      };
    }

    // Mark OTP as used
    await supabase
      .from('otp_tokens')
      .update({ used: true })
      .eq('id', matchedToken.id);

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (gymError || !gymProfile) {
      return {
        success: false,
        error: 'Gym profile not found',
      };
    }

    // Sign in the user with Supabase Auth
    // We need to get user data first, then generate a proper session
    const { data: authData, error: authError } =
      await supabase.auth.admin.getUserById(gymProfile.user_id);

    if (authError || !authData.user || !authData.user.email) {
      return {
        success: false,
        error: 'Failed to authenticate user',
      };
    }

    // FIXED: Generate proper session tokens using Supabase Admin API
    // This creates a valid magic link session for the user
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: authData.user.email,
      });

    if (linkError || !linkData || !linkData.properties) {
      console.error('Failed to generate session link:', linkError);
      return {
        success: false,
        error: 'Failed to create session',
      };
    }

    // Set the session using properly generated tokens
    // Type assertion needed as GenerateLinkProperties doesn't expose token types
    const properties = linkData.properties as unknown as {
      access_token: string;
      refresh_token: string;
    };

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: properties.access_token,
      refresh_token: properties.refresh_token,
    });

    if (sessionError) {
      console.error('Session error:', sessionError);
      return {
        success: false,
        error: 'Failed to establish session',
      };
    }

    return {
      success: true,
      data: {
        user: authData.user as AuthUser,
        gymProfile: gymProfile as GymProfile,
      },
    };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// ============================================================
// CLEANUP EXPIRED OTP TOKENS
// ============================================================

export async function cleanupExpiredOtpTokens(): Promise<void> {
  try {
    const supabase = await createClient();

    // Delete OTP tokens older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    await supabase.from('otp_tokens').delete().lt('created_at', oneHourAgo);
  } catch (error) {
    console.error('Cleanup OTP tokens error:', error);
  }
}

// ============================================================
// UPDATE PHONE NUMBER
// ============================================================

export async function updatePhoneNumber(
  userId: string,
  phoneNumber: string,
  otpCode: string
): Promise<AuthResponse<GymProfile>> {
  try {
    const supabase = await createClient();

    // Verify OTP - fetch all valid tokens to compare hashes
    const { data: otpTokens, error: otpError } = await supabase
      .from('otp_tokens')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (otpError || !otpTokens || otpTokens.length === 0) {
      return {
        success: false,
        error: 'Invalid or expired OTP',
      };
    }

    // Find matching OTP by comparing hashed values
    let matchedToken = null;
    for (const token of otpTokens) {
      const isMatch = await bcrypt.compare(otpCode, token.otp_code);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      return {
        success: false,
        error: 'Invalid or expired OTP',
      };
    }

    // Mark OTP as used
    await supabase
      .from('otp_tokens')
      .update({ used: true })
      .eq('id', matchedToken.id);

    // Check if phone number is already in use
    const { data: existingGym } = await supabase
      .from('gyms')
      .select('id')
      .eq('phone_number', phoneNumber)
      .neq('user_id', userId)
      .single();

    if (existingGym) {
      return {
        success: false,
        error: 'Phone number already in use',
      };
    }

    // Update phone number
    const { data: updatedProfile, error: updateError } = await supabase
      .from('gyms')
      .update({
        phone_number: phoneNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError || !updatedProfile) {
      return {
        success: false,
        error: 'Failed to update phone number',
      };
    }

    return {
      success: true,
      data: updatedProfile as GymProfile,
    };
  } catch (error) {
    console.error('Update phone number error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
