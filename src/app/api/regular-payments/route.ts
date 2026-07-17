import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getRegularPayments } from '@/features/payments/services/payment-reports.service';

// GET /api/regular-payments?filter=overdue|due_today|upcoming|all&sortBy=due_date_asc|member_name
// Returns members with payments pending, joined with discount info.
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') ?? 'overdue';
    const sortBy = searchParams.get('sortBy') ?? 'due_date_asc';

    const data = await getRegularPayments(gymProfile.id, filter, sortBy);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('GET regular-payments error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch regular payments' },
      { status: 500 }
    );
  }
}
