/**
 * /api/cron/purge-access-events — retention for door scans.
 *
 * Schedule: `0 2 * * *` — 02:00 UTC, 07:30 Sri Lanka time. Deliberately clear
 * of the member-status chain (00:00–00:50 UTC) and of `reconcile-access` at
 * 18:30, because this job depends on none of them and none of them depend on
 * it: it reads nothing a status cron writes and writes nothing any of them
 * read. It is therefore **not** part of `cron-schedule-order.test.ts`, for the
 * same reason `reconcile-access` is not.
 *
 * ## Why daily
 *
 * The privacy policy states twelve months. A monthly sweep would let the
 * oldest scans reach thirteen, quietly making the published figure untrue for
 * weeks at a time. Most nights this deletes nothing and costs one indexed
 * query.
 *
 * Logs to the cron audit table like every other job (rule 2.6).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPurgeExpiredAccessEvents } from '@/features/access-control'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

export const dynamic = 'force-dynamic'
// Batched deletes, so a large first run walks the backlog rather than
// attempting it in one statement.
export const maxDuration = 60

async function runPurge(request: NextRequest) {
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
    logId = await logger.logStart('purge-access-events')

    const summary = await createPurgeExpiredAccessEvents(supabase).execute()

    const payload = {
      ...summary,
      duration: `${Date.now() - startedAt}ms`,
    }

    await logger.logSuccess(logId, payload)

    return NextResponse.json(ResponseBuilder.success(payload))
  } catch (error) {
    console.error('Purge access events cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to purge expired access events',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return runPurge(request)
}

export async function POST(request: NextRequest) {
  return runPurge(request)
}
