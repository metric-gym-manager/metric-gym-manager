/**
 * /api/cron/sync-marketing-contacts — the nightly reconcile of the Resend
 * mailing list with the gyms (owner decisions of 2026-10-06).
 *
 * Schedule: `0 1 * * *` — 01:00 UTC, 06:30 Sri Lanka time. AFTER the status
 * crons, because it reads `gyms.subscription_status`, which process-dunning
 * (00:45) and process-trial-expiry (00:50) write: a gym suspended tonight
 * leaves "Product updates" in the same night. It writes nothing any of them
 * read, so it is not part of `cron-schedule-order.test.ts`.
 *
 * What it does (`SyncMarketingContacts`): every gym and consenting lead in
 * Marketing; current subscriptions also in Product updates, cancelled and
 * suspended gyms taken out of it; a gym whose email changed moves to the new
 * address with its opt-outs; addresses that are nobody's taken off. It never
 * rotates unsubscribe tokens — that is a deliberate script run.
 *
 * Exclusions: `SMS_DISABLED_GYM_IDS` (the E2E gyms) and
 * `MARKETING_EXCLUDED_GYM_IDS` (owner and test accounts), plus reserved TLDs.
 * Logs to the cron audit table like every other job (rule 2.6).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSyncMarketingContacts } from '@/features/mailing'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

export const dynamic = 'force-dynamic'
// The first run after a large change may move or add many contacts, each a
// few Resend calls; steady state is two list calls.
export const maxDuration = 300

function idsFrom(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

async function runSync(request: NextRequest) {
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
    logId = await logger.logStart('sync-marketing-contacts')

    const report = await createSyncMarketingContacts(supabase).execute({
      apply: true,
      excludeGymIds: [
        ...idsFrom(process.env.SMS_DISABLED_GYM_IDS),
        ...idsFrom(process.env.MARKETING_EXCLUDED_GYM_IDS),
      ],
      excludeEmails: [],
    })

    const counts: Record<string, number> = {}
    for (const entry of report) {
      const key = `${entry.action}:${entry.outcome}`
      counts[key] = (counts[key] ?? 0) + 1
    }
    const payload = {
      counts,
      failures: report
        .filter((entry) => entry.outcome === 'failed')
        .map((entry) => `${entry.email}: ${entry.error}`),
      duration: `${Date.now() - startedAt}ms`,
    }

    await logger.logSuccess(logId, payload)

    return NextResponse.json(ResponseBuilder.success(payload))
  } catch (error) {
    console.error('Sync marketing contacts cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to sync marketing contacts',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return runSync(request)
}

export async function POST(request: NextRequest) {
  return runSync(request)
}
