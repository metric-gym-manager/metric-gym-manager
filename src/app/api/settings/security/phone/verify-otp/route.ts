import { NextRequest, NextResponse } from 'next/server';
import { updatePhoneNumber } from '@/features/auth/services/otp.service';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { updatePhoneSchema } from '@/features/settings/schemas/settings.schemas';

// ============================================================
// POST /api/settings/security/phone/verify-otp - Verify OTP and update phone
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Get current user's gym profile
    const gymProfile = await getCurrentGymProfile();

    const body = await request.json();

    // Validate request body
    const validatedData = updatePhoneSchema.parse(body);

    // Call service function to verify OTP and update phone
    const result = await updatePhoneNumber(
      gymProfile.user_id,
      validatedData.phone_number,
      validatedData.otp_code
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Phone number updated successfully',
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verify OTP API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === 'Gym profile not found') {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      );
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
