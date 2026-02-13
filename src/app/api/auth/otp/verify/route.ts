import { NextRequest, NextResponse } from 'next/server';
import { phoneOtpVerifySchema } from '@/features/auth/schemas/auth.schemas';
import { verifyOtpAndLogin } from '@/features/auth/services/otp.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = phoneOtpVerifySchema.parse(body);

    // Verify OTP and login
    const result = await verifyOtpAndLogin(
      validatedData.phoneNumber,
      validatedData.otpCode
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
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
    console.error('OTP verify API error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
