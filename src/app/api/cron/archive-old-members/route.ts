import { NextRequest, NextResponse } from 'next/server';
// TODO: Create ArchiveOldMembers use case following Clean Architecture pattern
// For now, this functionality is temporarily disabled pending use case implementation

// ============================================================
// POST /api/cron/archive-old-members - Archive old members cron job
// Schedule: Monthly on the 1st at 1:00 AM (UTC+5:30)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET is not configured — refusing to run cron job');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 Archive old members cron job - temporarily disabled');

    // TODO: Implement ArchiveOldMembers use case
    return NextResponse.json(
      {
        success: false,
        error: 'Archive old members functionality temporarily disabled',
        message: 'Pending Clean Architecture use case implementation',
      },
      { status: 501 } // Not Implemented
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
  console.log('🧪 Manual test: Archive old members - temporarily disabled');

  // TODO: Implement ArchiveOldMembers use case
  return NextResponse.json({
    success: false,
    error: 'Archive old members functionality temporarily disabled',
    message: 'Pending Clean Architecture use case implementation',
  });
}
