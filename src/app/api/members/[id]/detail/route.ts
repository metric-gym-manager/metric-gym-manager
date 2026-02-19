import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// GET /api/members/[id]/detail
// Returns member + payment history + installments in a single
// request with all three DB queries running in parallel.
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id: memberId }, gymProfile, supabase] = await Promise.all([
      params,
      getCurrentGymProfile(),
      createClient(),
    ]);

    const gymId = gymProfile.id;

    // Run all three queries in parallel
    const [memberResult, paymentsResult, installmentsResult] = await Promise.all([
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

      supabase
        .from('member_installments')
        .select('*, installment_payments(*)')
        .eq('member_id', memberId)
        .eq('gym_id', gymId)
        .order('created_at', { ascending: false }),
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
          installments: installmentsResult.data ?? [],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get member detail API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch member details' }, { status: 500 });
  }
}
