import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getCollectedPayments } from '@/features/payments/services/payment-reports.service';
import { ResponseBuilder } from '@/utils/api/ApiResponse';

/**
 * Helper function to get the current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// GET /api/payment-collection/collected?month=YYYY-MM&planType=monthly&search=name
// Returns collected payments for a specific month with summary metrics
export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') ?? getCurrentMonth();
    const planType = searchParams.get('planType') ?? 'all';
    const search = searchParams.get('search') ?? '';

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        ResponseBuilder.badRequest('Invalid month format. Use YYYY-MM'),
        { status: 400 }
      );
    }

    const data = await getCollectedPayments(gymProfile.id, month, planType, search);

    return NextResponse.json(ResponseBuilder.success(data), { status: 200 });
  } catch (error) {
    console.error('GET payment-collection/collected error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to fetch collected payments',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}
