import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// GET /api/members/[id]/sms-history - Get SMS history for a member
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const gymProfile = await getCurrentGymProfile();
    const supabase = await createClient();

    // Verify member belongs to gym and get plan details for grouping
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, name, phone_number, plan_type, membership_start_date, next_due_date')
      .eq('id', memberId)
      .eq('gym_id', gymProfile.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    // Fetch SMS logs for this member, ordered by most recent first
    const { data: smsLogs, error: logsError } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('member_id', memberId)
      .eq('gym_id', gymProfile.id)
      .order('sent_at', { ascending: false });

    if (logsError) {
      console.error('Fetch SMS logs error:', logsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch SMS history' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          member,
          smsLogs: smsLogs || [],
          totalCount: smsLogs?.length || 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get SMS history API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch SMS history' },
      { status: 500 }
    );
  }
}
