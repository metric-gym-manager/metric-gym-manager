import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSmsViaTextLk } from '@/features/sms/services/textlk.service';
import bcrypt from 'bcrypt';

// ============================================================
// POST /api/settings/security/phone/request-otp - Request OTP for phone update
// ============================================================

const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const OTP_RATE_LIMIT_PER_HOUR = 3;
const BCRYPT_SALT_ROUNDS = 10;

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number } = body;

    // Validate phone number format
    if (!phone_number || !/^\+94[0-9]{9}$/.test(phone_number)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number format. Must be +94XXXXXXXXX',
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check rate limit (max 3 requests per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentAttempts, error: rateLimitError } = await supabase
      .from('otp_tokens')
      .select('id')
      .eq('phone_number', phone_number)
      .gte('created_at', oneHourAgo);

    if (rateLimitError) {
      return NextResponse.json(
        { success: false, error: 'Failed to verify rate limit' },
        { status: 500 }
      );
    }

    if (recentAttempts && recentAttempts.length >= OTP_RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many OTP requests. Please try again later.',
        },
        { status: 429 }
      );
    }

    // Generate OTP code
    const otpCode = generateOtpCode();

    // Hash OTP code with bcrypt for security
    const hashedOtp = await bcrypt.hash(otpCode, BCRYPT_SALT_ROUNDS);

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_SECONDS * 1000
    ).toISOString();

    // Store HASHED OTP in database
    const { error: insertError } = await supabase.from('otp_tokens').insert({
      phone_number: phone_number,
      otp_code: hashedOtp,
      expires_at: expiresAt,
      used: false,
    });

    if (insertError) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate OTP' },
        { status: 500 }
      );
    }

    // Send OTP via SMS (real or mock based on feature flag)
    const useRealSms = process.env.ENABLE_REAL_SMS === 'true';

    if (useRealSms) {
      const result = await sendSmsViaTextLk({
        to: phone_number,
        message: `Your verification code is: ${otpCode}. Valid for 10 minutes.`,
      });

      if (!result.success) {
        console.error('Failed to send OTP SMS via text.lk:', result.error);
      } else {
        console.log(`✓ OTP sent via text.lk (ID: ${result.message_id})`);
      }
    } else {
      console.log(`[MOCK SMS] OTP for ${phone_number}: ${otpCode}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'OTP sent successfully. Please check your phone.',
        expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Request OTP API error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
