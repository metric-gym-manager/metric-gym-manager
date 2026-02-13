import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { getYearlyRevenue } from '@/features/revenue/services/revenue.service';
import { yearlyRevenueQuerySchema } from '@/features/revenue/schemas/revenue.schemas';

// ============================================================
// GET /api/revenue/yearly - Get yearly revenue data
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const validatedParams = yearlyRevenueQuerySchema.parse({
      year: parseInt(searchParams.get('year') || new Date().getFullYear().toString()),
    });

    // Get revenue data
    const result = await getYearlyRevenue(gymProfile.id, validatedParams.year);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get yearly revenue API error:', error);

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
      { success: false, error: 'Failed to fetch yearly revenue' },
      { status: 500 }
    );
  }
}
