import { NextRequest, NextResponse } from 'next/server';
import { phoneOtpRequestSchema } from '@/features/auth/schemas/auth.schemas';
import { requestOtp } from '@/features/auth/services/otp.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = phoneOtpRequestSchema.parse(body);

    // Request OTP
    const result = await requestOtp(validatedData.phoneNumber);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('OTP request API error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
