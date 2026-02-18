import { NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// GET /api/discounts - Get active discounts for the gym
// ============================================================

export async function GET() {
  try {
    const gymProfile = await getCurrentGymProfile();
    const supabase = await createClient();

    const { data: discounts, error } = await supabase
      .from('discounts')
      .select('id, discount_name, discount_percentage')
      .eq('gym_id', gymProfile.id)
      .eq('is_active', true)
      .order('discount_name');

    if (error) {
      console.error('Fetch discounts error:', error);
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        data: discounts || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get discounts API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}
