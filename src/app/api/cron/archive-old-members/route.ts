import { NextRequest, NextResponse } from 'next/server';
// TODO: Create ArchiveOldMembers use case following Clean Architecture pattern
// For now, this functionality is temporarily disabled pending use case implementation

// ============================================================
// /api/cron/archive-old-members - Archive old members cron job
// Schedule: Monthly on the 1st at 1:00 AM (UTC+5:30)
//
// Vercel Cron invokes this path with an HTTP GET request, so the
// job must run on GET as well as POST. Both verify the CRON_SECRET
// bearer token.
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function runArchiveOldMembers(request: NextRequest) {
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

// Vercel Cron triggers this handler
export async function GET(request: NextRequest) {
  // In development, allow GET without auth for easy manual testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 Manual test: Archive old members - temporarily disabled');

    // TODO: Implement ArchiveOldMembers use case
    return NextResponse.json({
      success: false,
      error: 'Archive old members functionality temporarily disabled',
      message: 'Pending Clean Architecture use case implementation',
    });
  }

  return runArchiveOldMembers(request);
}

// Manual/external trigger (e.g. curl with the bearer token)
export async function POST(request: NextRequest) {
  return runArchiveOldMembers(request);
}
