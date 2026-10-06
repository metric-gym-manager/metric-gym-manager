/**
 * /api/cron/send-announcements — emails the gyms when a new version reaches
 * production and when a legal page changes (owner request, 2026-10-06).
 *
 * Schedule: `0 4 * * *` — 04:00 UTC, 09:30 Sri Lanka time. After the 01:00
 * `sync-marketing-contacts`, so the "Product updates" segment is current. It
 * writes nothing the member-status crons read, so it is not part of
 * `cron-schedule-order.test.ts`.
 *
 * What it does (`SendAnnouncements`): for the deployed `APP_VERSION`, the
 * matching CHANGELOG.md section (and any unannounced ones before it) becomes a
 * release email; for each legal page, the newest `LEGAL_CHANGES` entry marked
 * `notify` becomes a policy notice. Each is filled into its Resend template,
 * previewed to the Test segment at once, and scheduled to the gyms 24 hours
 * later — cancelling the broadcast in Resend stops it. Nothing is announced
 * twice (`mailing_announcements`).
 *
 * CHANGELOG.md is read from disk, so `next.config.js` traces it into this
 * route's bundle (`outputFileTracingIncludes`); a test pins that.
 * Logs to the cron audit table like every other job (rule 2.6), as a failure
 * when an email could not be rendered, previewed or scheduled.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createSendAnnouncements,
  type AnnouncementOutcome,
} from '@/features/mailing'
import { LEGAL_CHANGES } from '@/features/marketing/config/legalChanges'
import { APP_VERSION } from '@/lib/client-state/app-version'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import { CronLogger } from '@/lib/cron'

export const dynamic = 'force-dynamic'
// A handful of Resend calls per announcement; usually none at all.
export const maxDuration = 60

const FAILED: ReadonlySet<AnnouncementOutcome> = new Set([
  'render_failed',
  'preview_failed',
  'send_failed',
  'refresh_failed',
])

async function runAnnouncements(request: NextRequest) {
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
    logId = await logger.logStart('send-announcements')

    const report = await createSendAnnouncements(supabase).execute({
      appVersion: APP_VERSION,
      changelog: readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8'),
      legalChanges: LEGAL_CHANGES,
      now: new Date(),
    })

    const counts: Record<string, number> = {}
    for (const entry of report) {
      const key = `${entry.kind}:${entry.outcome}`
      counts[key] = (counts[key] ?? 0) + 1
    }
    const failures = report
      .filter((entry) => FAILED.has(entry.outcome))
      .map(
        (entry) =>
          `${entry.kind} ${entry.ref}: ${entry.outcome}` +
          (entry.detail ? ` — ${entry.detail}` : '')
      )
    const payload = {
      counts,
      entries: report.map(({ kind, ref, outcome, detail, scheduledFor }) => ({
        kind,
        ref,
        outcome,
        ...(detail ? { detail } : {}),
        ...(scheduledFor ? { scheduledFor } : {}),
      })),
      duration: `${Date.now() - startedAt}ms`,
    }

    if (failures.length > 0) {
      await logger.logFailure(logId, failures, payload)
    } else {
      await logger.logSuccess(logId, payload)
    }

    return NextResponse.json(ResponseBuilder.success(payload))
  } catch (error) {
    console.error('Send announcements cron error:', error)

    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ])
    }

    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to send announcements',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return runAnnouncements(request)
}

export async function POST(request: NextRequest) {
  return runAnnouncements(request)
}
