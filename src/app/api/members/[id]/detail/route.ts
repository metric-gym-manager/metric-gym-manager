import { NextRequest, NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { getMemberDetail } from '@/features/members/services/member-queries.service';

// ============================================================
// GET /api/members/[id]/detail
// Returns member + payment history in a single
// request with both DB queries running in parallel.
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const { gymProfile, error: authError } = await getApiGymProfile();

    if (authError) {
      return authError;
    }

    const detail = await getMemberDetail(gymProfile!.id, memberId);

    if (!detail) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          member: detail.member,
          payments: detail.payments,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get member detail API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch member details' }, { status: 500 });
  }
}
