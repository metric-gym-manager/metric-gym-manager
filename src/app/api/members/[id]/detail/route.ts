import { NextRequest, NextResponse } from 'next/server';
import { getApiGymProfile } from '@/lib/middleware/api-auth';
import { createClient } from '@/lib/supabase/server';

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

    const supabase = await createClient();
    const gymId = gymProfile!.id;

    // Run both queries in parallel
    const [memberResult, paymentsResult] = await Promise.all([
      supabase
        .from('members')
        .select('*, discount:discounts(id, discount_name, discount_percentage)')
        .eq('id', memberId)
        .eq('gym_id', gymId)
        .single(),

      supabase
        .from('payments')
        .select('*')
        .eq('member_id', memberId)
        .eq('gym_id', gymId)
        .order('payment_date', { ascending: false }),
    ]);

    if (memberResult.error || !memberResult.data) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          member: memberResult.data,
          payments: paymentsResult.data ?? [],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get member detail API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch member details' }, { status: 500 });
  }
}
