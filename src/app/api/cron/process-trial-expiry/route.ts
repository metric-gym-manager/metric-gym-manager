import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createProcessTrialExpiry } from '@/features/subscriptions'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'
import { safeEqual } from '@/lib/auth/safeEqual'

export const runtime = 'nodejs'

// ============================================================
// POST /api/cron/process-trial-expiry — SaaS onboarding trial expiry
// Schedule: daily 00:50 UTC (vercel.json)
//
// trialing past trial_ends_at -> suspended (tier preserved).
// A successful checkout converts trialing -> active via the webhook, so
// expired rows by definition never checked out. Decision in SQL on the DB
// clock (process_trial_expiry); members NEVER touched.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const logger = new CronLogger(supabase)
  let logId: string | null = null

  try {
    // Constant-time secret check; NO dev fallback secret (fail closed)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (
      !cronSecret ||
      !authHeader ||
      !safeEqual(authHeader, `Bearer ${cronSecret}`)
    ) {
      console.error('Unauthorized trial-expiry cron request')
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    console.log('🚀 Starting process-trial-expiry cron job...')
    const startTime = Date.now()

    logId = await logger.logStart('process-trial-expiry')

    const summary =
      await createProcessTrialExpiry(createAdminClient()).execute()

    const duration = Date.now() - startTime
    console.log(`⏱️  Trial-expiry cron completed in ${duration}ms`)

    await logger.logSuccess(logId, {
      suspendedTrials: summary.suspendedTrials,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      ResponseBuilder.success({ ...summary, duration: `${duration}ms` }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Process trial-expiry cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to process trial expiry',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

// Vercel Cron calls GET. Until 2026-10-06 this answered `405 Method not
// allowed in production` (and ran the job with NO auth in development), so
// the job never ran in production. GET is now the same authenticated handler
// as POST, in every environment (billing-crons.test.ts).
export async function GET(request: NextRequest) {
  return POST(request)
}
