import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnnouncementProgress } from '@/features/announcements/services/announcement.service';

// ============================================================
// GET /api/announcements/[id]/progress - Get announcement progress
// ============================================================

export async function GET(
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

    const data = await getAnnouncementProgress(gymProfile.id, id);

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Announcement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('Get announcement progress error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch announcement progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
