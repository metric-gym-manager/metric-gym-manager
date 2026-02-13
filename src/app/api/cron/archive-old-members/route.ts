import { NextRequest, NextResponse } from 'next/server';
import { archiveOldMembers } from '@/features/sms/services/reminder.service';

// ============================================================
// POST /api/cron/archive-old-members - Archive old members cron job
// Schedule: Monthly on the 1st at 1:00 AM (UTC+5:30)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-key';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 Starting archive old members cron job...');
    const startTime = Date.now();

    // Archive old members
    const results = await archiveOldMembers();

    const duration = Date.now() - startTime;

    console.log(`⏱️  Cron job completed in ${duration}ms`);

    return NextResponse.json(
      {
        success: true,
        data: {
          totalArchived: results.totalArchived,
          errors: results.errors,
          duration: `${duration}ms`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Archive old members cron error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to archive old members',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Allow GET for manual testing (only in development)
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Method not allowed in production' },
      { status: 405 }
    );
  }

  // In development, allow GET without auth for easy testing
  console.log('🧪 Manual test: Starting archive old members cron job...');

  const results = await archiveOldMembers();

  return NextResponse.json({
    success: true,
    data: results,
  });
}
