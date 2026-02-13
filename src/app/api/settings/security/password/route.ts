import { NextRequest, NextResponse } from 'next/server';
import { updatePassword } from '@/features/auth/services/auth.service';
import { updatePasswordSchema } from '@/features/settings/schemas/settings.schemas';

// ============================================================
// POST /api/settings/security/password - Change password
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = updatePasswordSchema.parse(body);

    // Call service function
    const result = await updatePassword({
      currentPassword: validatedData.current_password,
      newPassword: validatedData.new_password,
      confirmPassword: validatedData.confirm_password,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Password updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Change password API error:', error);

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update password' },
      { status: 500 }
    );
  }
}
