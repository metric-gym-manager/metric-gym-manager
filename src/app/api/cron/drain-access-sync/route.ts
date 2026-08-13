/**
 * /api/cron/drain-access-sync — the outbox worker.
 *
 * Schedule: every five minutes. This is the only thing that moves queued
 * changes onto the hardware, so without it the `access_sync_jobs` rows the
 * members trigger writes simply accumulate.
 *
 * Five minutes is a deliberate compromise. Registrations and payments already
 * dispatch inline, so this is the retry and catch-up path rather than the
 * happy path; a member whose change missed the inline attempt waits minutes,
 * not hours, and the reader is not hammered on a tighter loop for the sake of
 * a case that mostly does not arise.
 *
 * Vercel Cron issues a GET, so the job runs on GET as well as POST, both
 * behind the `CRON_SECRET` bearer token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createDrainAccessSyncQueue,
  createRefreshDeviceStatus,
} from '@/features/access-control'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

export const dynamic = 'force-dynamic'
// A full batch is paced against the vendor rate limit, so it can run long.
export const maxDuration = 60

async function runDrain(request: NextRequest) {
  const supabase = createAdminClient()
  const logger = new CronLogger(supabase)
  let logId: string | null = null

  try {
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET is not configured — refusing to run cron job')
      return NextResponse.json(
        ResponseBuilder.internalError('Server misconfigured'),
        { status: 500 }
      )
    }

    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json(ResponseBuilder.unauthorized(), { status: 401 })
    }

    const startedAt = Date.now()
    logId = await logger.logStart('drain-access-sync')

    const summary = await createDrainAccessSyncQueue(supabase).execute()

    // Presence rides along with the drain rather than getting its own
    // schedule. Webhook events only arrive when somebody scans, so a gym that
    // closed at 10pm would otherwise show every reader as offline by morning —
    // a false alarm on the one screen whose job is to prevent exactly that.
    const presence = await createRefreshDeviceStatus(supabase).execute()

    const payload = {
      ...summary,
      devicesChecked: presence.devicesChecked,
      devicesSeen: presence.devicesSeen,
      // A registered reader the vendor does not know is a configuration
      // problem, not an outage, and reads differently in the log.
      devicesUnknownToVendor: presence.unknownToVendor,
      errors: [...summary.errors, ...presence.errors],
      duration: `${Date.now() - startedAt}ms`,
    }

    // Dead-lettered jobs that need a person — a full reader, a rejected
    // template — are recorded as a failure so they surface on the SaaS-admin
    // health view rather than sitting quietly in a successful run.
    if (summary.needingAttention > 0) {
      await logger.logFailure(logId, summary.errors)
    } else {
      await logger.logSuccess(logId, payload)
    }

    return NextResponse.json(ResponseBuilder.success(payload))
  } catch (error) {
    console.error('Drain access sync cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to drain the access sync queue',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return runDrain(request)
}

export async function POST(request: NextRequest) {
  return runDrain(request)
}
