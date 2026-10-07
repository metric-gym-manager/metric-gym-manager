/**
 * /api/cron/send-outreach — the introduction series to gyms whose contact
 * details are on public pages (owner request, 2026-10-06), one email a week
 * per address.
 *
 * Schedule: `30 4 * * *` — daily at 04:30 UTC, 10:00 Sri Lanka time. Daily,
 * not weekly, because individual emails count against Resend's 100-a-day
 * limit: each run sends at most OUTREACH_DAILY_LIMIT, and the six-day gap
 * decides who is due, so every address still gets one email a week.
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
 *
 * Nothing is sent while the campaign is paused by the safety brake
 * (`OutreachBrake`); a paused run is logged as a failure naming the reason.
 * On Mondays it first sends the owner the weekly summary — guarded, so a
 * failed summary is logged and never stops the day's emails.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  OUTREACH_CAMPAIGN,
  OUTREACH_DAILY_LIMIT,
  OUTREACH_STARTS_AT,
  createSendOutreach,
  createSendOutreachSummary,
} from '@/features/mailing'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

export const dynamic = 'force-dynamic'
// A few Resend calls per address; 150 addresses fit comfortably.
export const maxDuration = 300
const START_SENDS_FOR_MS = 180_000

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

    const now = new Date()
    if (now < OUTREACH_STARTS_AT) {
      const payload = {
        campaign: OUTREACH_CAMPAIGN,
        notStarted: true,
        startsAt: OUTREACH_STARTS_AT.toISOString(),
      }
      await logger.logSuccess(logId, payload)
      return NextResponse.json(ResponseBuilder.success(payload))
    }
    const failures: string[] = []
    let summary = 'not_sent'
    try {
      summary = (
        await createSendOutreachSummary(supabase).sendIfDue(
          OUTREACH_CAMPAIGN,
          now
        )
      ).outcome
    } catch (error) {
      failures.push(
        `weekly summary: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    const report = await createSendOutreach(supabase).runWeek({
      campaign: OUTREACH_CAMPAIGN,
      now,
      limit: OUTREACH_DAILY_LIMIT,
      dryRun: false,
      // Stop starting sends two minutes before the function's 300 s limit, so
      // a run is never cut off between claiming an email and sending it.
      deadline: new Date(now.getTime() + START_SENDS_FOR_MS),
    })

    for (const entry of report.entries) {
      if (entry.outcome === 'failed') {
        failures.push(
          `${entry.email} (email ${entry.step}): ${entry.detail ?? 'failed'}`
        )
      }
    }
    if (report.paused) {
      failures.push(
        `campaign paused: ${report.paused.reason} (resume with --resume)`
      )
    }
    const payload = {
      campaign: OUTREACH_CAMPAIGN,
      counts: report.counts,
      ...(report.paused ? { paused: report.paused.reason } : {}),
      summary,
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
