import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createProcessDunning } from '@/features/subscriptions'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'
import { safeEqual } from '@/lib/auth/safeEqual'

export const runtime = 'nodejs'

// ============================================================
// POST /api/cron/process-dunning — SaaS billing dunning pass
// Schedule: daily 00:45 UTC (vercel.json)
//
// 1. past_due beyond grace     -> suspended (tier preserved)
// 2. canceled past period end  -> suspended (voluntary cancel lapses)
// 3. stale pending checkout intents -> expired
// No downgrade landing tier exists — dunning changes STATUS only.
// All decisions in SQL on the DB clock; members NEVER touched.
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
      console.error('Unauthorized dunning cron request')
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    console.log('🚀 Starting process-dunning cron job...')
    const startTime = Date.now()

    logId = await logger.logStart('process-dunning')

    const summary = await createProcessDunning(createAdminClient()).execute()

    const duration = Date.now() - startTime
    console.log(`⏱️  Dunning cron completed in ${duration}ms`)

    await logger.logSuccess(logId, {
      suspendedPastDue: summary.suspendedPastDue,
      suspendedCanceled: summary.suspendedCanceled,
      intentsExpired: summary.intentsExpired,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      ResponseBuilder.success({ ...summary, duration: `${duration}ms` }),
      { status: 200 }
    )
  } catch (error) {
    console.error('Process dunning cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to process dunning',
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
