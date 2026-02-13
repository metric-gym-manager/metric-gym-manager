import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getMonthlyRevenue } from '@/features/revenue/services/revenue.service';
import { monthlyRevenueQuerySchema } from '@/features/revenue/schemas/revenue.schemas';

// ============================================================
// GET /api/revenue/monthly - Get monthly revenue data
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const validatedParams = monthlyRevenueQuerySchema.parse({
      year: parseInt(searchParams.get('year') || new Date().getFullYear().toString()),
      month: parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString()),
    });

    // Get revenue data
    const result = await getMonthlyRevenue(
      gymProfile.id,
      validatedParams.year,
      validatedParams.month
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get monthly revenue API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch monthly revenue' },
      { status: 500 }
    );
  }
}
