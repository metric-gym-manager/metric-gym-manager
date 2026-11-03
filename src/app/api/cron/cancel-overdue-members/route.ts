import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCancelOverdueMembers } from '@/features/members'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

// ============================================================
// /api/cron/cancel-overdue-members - Cancel members overdue by 14+ days
// Schedule: daily 00:30 UTC (vercel.json)
//
// Nightly member-status chain — ORDER MATTERS. This is the CONSUMER: it only
// sees members already in Expired, so it must run AFTER both feeders —
// update-expired-status (00:00, Active -> Expired) and
// expire-suspended-members (00:15, Suspended -> Expired). Scheduling it
// earlier does not lose members (the sweep is date-based, not incremental),
// but it delays each of them by a full day.
//
// Shares the 00:30 slot with charge-renewals; the two touch disjoint tables
// (members vs. SaaS billing) and are safe to run concurrently.
//
// Vercel Cron invokes this path with an HTTP GET request, so the
// job must run on GET as well as POST. Both verify the CRON_SECRET
// bearer token.
// ============================================================

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function runCancelOverdueMembers(request: NextRequest) {
  const supabase = createAdminClient()
  const logger = new CronLogger(supabase)
  let logId: string | null = null

  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET is not configured — refusing to run cron job')
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    console.log('🚀 Starting cancel overdue members cron job...')
    const startTime = Date.now()

    // Log cron job start
    logId = await logger.logStart('cancel-overdue-members')

    // Cancel overdue members via use case
    const cancelOverdue = createCancelOverdueMembers(createAdminClient())
    const summary = await cancelOverdue.execute()

    const duration = Date.now() - startTime

    console.log(`⏱️  Cron job completed in ${duration}ms`)

    // Log successful completion
    await logger.logSuccess(logId, {
      totalCancelled: summary.totalCancelled,
      cancelledMembers: summary.cancelledMembers,
      errors: summary.errors,
      skippedChanged: summary.skippedChanged,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      ResponseBuilder.success({
        totalCancelled: summary.totalCancelled,
        cancelledMembers: summary.cancelledMembers,
        errors: summary.errors,
        skippedChanged: summary.skippedChanged,
        duration: `${duration}ms`,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Cancel overdue members cron error:', error)

    // Log failure if we have a log ID
    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to cancel overdue members',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

// Vercel Cron triggers this handler
export async function GET(request: NextRequest) {
  // In development, allow GET without auth for easy manual testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 Manual test: Starting cancel overdue members cron job...')

    const cancelOverdue = createCancelOverdueMembers(createAdminClient())
    const summary = await cancelOverdue.execute()

    return NextResponse.json(ResponseBuilder.success(summary))
  }

  return runCancelOverdueMembers(request)
}

// Manual/external trigger (e.g. curl with the bearer token)
export async function POST(request: NextRequest) {
  return runCancelOverdueMembers(request)
}
