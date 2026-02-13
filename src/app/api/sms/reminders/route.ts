import { NextRequest, NextResponse } from 'next/server';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import { reminderFiltersSchema } from '@/features/sms/schemas/sms.schemas';
import { getReminderStatus } from '@/features/sms/services/sms.service';

// ============================================================
// GET /api/sms/reminders - Get reminder status for all members
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const gymProfile = await getCurrentGymProfile();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters = {
      filter: searchParams.get('filter') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
    };

    // Validate filters
    const validatedFilters = reminderFiltersSchema.parse(filters);

    // Get reminder status
    const reminders = await getReminderStatus(gymProfile.id, validatedFilters);

    return NextResponse.json(
      {
        success: true,
        data: {
          reminders,
          totalCount: reminders.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get reminders API error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch reminders' },
      { status: 500 }
    );
  }
}
