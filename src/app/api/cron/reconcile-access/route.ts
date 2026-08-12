/**
 * /api/cron/reconcile-access — the nightly diff.
 *
 * Schedule: `30 18 * * *` — 18:30 UTC, which is **00:00 Sri Lanka time**. That
 * is the point of the slot: a membership paid through the 15th admits the
 * member all of the 15th and refuses them from the 16th at midnight *local*,
 * and this is what re-asserts the window at that boundary.
 *
 * ## Why it does not follow the status chain
 *
 * It runs six hours *before* `update-expired-status`, and that is safe because
 * `resolveAccessDecision` derives expiry from `next_due_date`, not from
 * `members.status`. The verdict is correct whether or not the status cron has
 * run — which is precisely what frees this job to sit at local midnight
 * instead of waiting for 00:00 UTC.
 *
 * It is therefore deliberately excluded from `cron-schedule-order.test.ts`,
 * which pins the Active→Expired→Cancelled ordering. Adding it there would
 * assert a dependency that does not exist and would block this slot.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createReconcileMemberAccess } from '@/features/access-control'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

export const dynamic = 'force-dynamic'
// Sweeps every gym with access control configured.
export const maxDuration = 60

async function runReconcile(request: NextRequest) {
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
    logId = await logger.logStart('reconcile-access')

    const summary = await createReconcileMemberAccess(supabase).execute()

    const payload = {
      ...summary,
      duration: `${Date.now() - startedAt}ms`,
    }

    if (summary.errors.length > 0) {
      await logger.logFailure(logId, summary.errors)
    } else {
      await logger.logSuccess(logId, payload)
    }

    return NextResponse.json(ResponseBuilder.success(payload))
  } catch (error) {
    console.error('Reconcile access cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to reconcile member access',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return runReconcile(request)
}

export async function POST(request: NextRequest) {
  return runReconcile(request)
}
