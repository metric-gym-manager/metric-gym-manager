/**
 * /api/cron/send-outreach — the weekly introduction series to gyms whose
 * contact details are on public pages (owner request, 2026-10-06).
 *
 * Schedule: `30 4 * * 2` — Tuesdays at 04:30 UTC, 10:00 Sri Lanka time.
 * Each address in `outreach_recipients` gets its next email of the four (at
 * least six days after the last), then no more; anyone who unsubscribed —
 * by the footer link or a mail app's one-click button — is dropped for good.
 * It writes nothing the member-status crons read, so it is not part of
 * `cron-schedule-order.test.ts`.
 *
 * Every email is tagged in Resend (kind, campaign, email number), so the
 * sends can be filtered in Resend's email log; this run's counts and any
 * failed sends are logged to the cron audit table (rule 2.6) — as a failure
 * when an email failed, so it shows on /system-health.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  OUTREACH_CAMPAIGN,
  OUTREACH_WEEKLY_LIMIT,
  createSendOutreach,
} from '@/features/mailing'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

export const dynamic = 'force-dynamic'
// A few Resend calls per address; 150 addresses fit comfortably.
export const maxDuration = 300

async function runOutreach(request: NextRequest) {
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
    logId = await logger.logStart('send-outreach')

    const report = await createSendOutreach(supabase).runWeek({
      campaign: OUTREACH_CAMPAIGN,
      now: new Date(),
      limit: OUTREACH_WEEKLY_LIMIT,
      dryRun: false,
    })

    const failures = report.entries
      .filter((entry) => entry.outcome === 'failed')
      .map(
        (entry) =>
          `${entry.email} (email ${entry.step}): ${entry.detail ?? 'failed'}`
      )
    const payload = {
      campaign: OUTREACH_CAMPAIGN,
      counts: report.counts,
      duration: `${Date.now() - startedAt}ms`,
    }

    if (failures.length > 0) {
      await logger.logFailure(logId, failures, payload)
    } else {
      await logger.logSuccess(logId, payload)
    }

    return NextResponse.json(ResponseBuilder.success(payload))
  } catch (error) {
    console.error('Send outreach cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to send outreach',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return runOutreach(request)
}

export async function POST(request: NextRequest) {
  return runOutreach(request)
}
