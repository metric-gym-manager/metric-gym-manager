import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { z } from 'zod';

// ============================================================
// POST /api/settings/security/username - Update username
// ============================================================

const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
});

export async function POST(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();
    const body = await request.json();

    // Validate request body
    const validatedData = updateUsernameSchema.parse(body);

    const supabase = await createClient();

    // Check if username is already taken by another gym
    const { data: existingGym } = await supabase
      .from('gyms')
      .select('id')
      .eq('username', validatedData.username)
      .neq('id', gymProfile.id)
      .single();

    if (existingGym) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken' },
        { status: 400 }
      );
    }

    // Update username
    const { data: updatedProfile, error: updateError } = await supabase
      .from('gyms')
      .update({
        username: validatedData.username,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gymProfile.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update username error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update username' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Username updated successfully',
        data: updatedProfile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update username API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update username' },
      { status: 500 }
    );
  }
}
