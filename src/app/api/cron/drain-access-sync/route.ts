/**
 * /api/cron/drain-access-sync — the outbox worker.
 *
 * Schedule: NONE at present — designed for every five minutes, disabled by
 * the owner on 2026-11-04. This is the only thing that moves queued changes
 * onto the hardware, so without it the `access_sync_jobs` rows the members
 * trigger writes simply accumulate.
 *
 * Five minutes is a deliberate compromise. Registration already dispatches
 * inline, so for a new member this is the retry path; payments, day passes,
 * status changes and the nightly reconcile reach a reader ONLY through here.
 * A member whose change is queued waits minutes, not hours, and the reader is
 * not hammered on a tighter loop.
 *
 * Why nothing schedules it: the Vercel team is on Hobby, which refuses to
 * deploy any cron that runs more than once a day, and the GitHub Actions
 * schedule that stood in for it never fired. It runs only by hand, through
 * `.github/workflows/drain-access-sync.yml` (workflow_dispatch, which POSTs).
 * GET stays for Vercel Cron should the job move back on Pro. Both sit behind
 * the `CRON_SECRET` bearer token. Re-enabling: access-control-master.md §4.5.
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
