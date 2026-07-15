import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Get announcement with progress
    const adminSupabase = createAdminClient();
    const { data: announcement, error: announcementError } = await adminSupabase
      .from('announcements')
      .select('id, message, recipient_count, sent_count, failed_count, status, sent_at, created_at, session_failures')
      .eq('id', id)
      .eq('gym_id', gymProfile.id)
      .single();

    if (announcementError || !announcement) {
      return NextResponse.json(
        { success: false, error: 'Announcement not found' },
        { status: 404 }
      );
    }

    // Get failures from session_failures JSON column
    interface SessionFailure {
      member_id: string;
      retry_count: number;
      [key: string]: unknown;
    }

    const sessionFailures = (announcement.session_failures || []) as SessionFailure[];

    // Get member names for failures
    const failuresWithNames = await Promise.all(
      sessionFailures.map(async (failure) => {
        const { data: member } = await adminSupabase
          .from('members')
          .select('name')
          .eq('id', failure.member_id)
          .single();

        return {
          ...failure,
          member_name: member?.name || 'Unknown',
        };
      })
    );

    // Separate failures by retry status
    const retryableFailures = failuresWithNames.filter((f) => f.retry_count < 3);
    const maxAttemptsFailures = failuresWithNames.filter((f) => f.retry_count >= 3);

    return NextResponse.json(
      {
        success: true,
        data: {
          announcement: {
            id: announcement.id,
            message: announcement.message,
            recipientCount: announcement.recipient_count,
            sentCount: announcement.sent_count || 0,
            failedCount: announcement.failed_count || 0,
            status: announcement.status,
            sentAt: announcement.sent_at,
            createdAt: announcement.created_at,
          },
          failures: {
            retryable: retryableFailures,
            maxAttempts: maxAttemptsFailures,
          },
        },
      },
      { status: 200 }
    );
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
