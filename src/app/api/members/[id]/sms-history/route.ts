import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getMemberSmsHistory } from '@/features/sms/services/sms-history.service';

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

    const result = await getMemberSmsHistory(gymProfile.id, memberId);

    if (result.status === 'member_not_found') {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    if (result.status === 'logs_error') {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch SMS history' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          member: result.member,
          smsLogs: result.smsLogs,
          totalCount: result.totalCount,
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
