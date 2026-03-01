import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clearSessionFailures } from '@/features/announcements/services/announcement.service';

// ============================================================
// POST /api/announcements/[id]/dismiss - Clear session failures
// ============================================================

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get gym profile
    const { data: gymProfile, error: gymError } = await supabase
      .from('gyms')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (gymError || !gymProfile) {
      return NextResponse.json(
        { success: false, error: 'Gym profile not found' },
        { status: 404 }
      );
    }

    // Verify announcement belongs to this gym
    const { data: announcement, error: announcementError } = await supabase
      .from('announcements')
      .select('id')
      .eq('id', id)
      .eq('gym_id', gymProfile.id)
      .single();

    if (announcementError || !announcement) {
      return NextResponse.json(
        { success: false, error: 'Announcement not found' },
        { status: 404 }
      );
    }

    // Clear session failures
    await clearSessionFailures(id);

    return NextResponse.json(
      {
        success: true,
        message: 'Session failures cleared',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Dismiss announcement error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to dismiss announcement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
