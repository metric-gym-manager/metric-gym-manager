/**
 * GET /api/admin/system-health/access-control
 *
 * The raw truth about door hardware, for SaaS operators only.
 *
 * Rule 2.9 draws a hard line: gym managers get sanitized state — "Access
 * update pending", "Reader offline" — and every vendor return code, database
 * message and dead-lettered job lives here instead. Without this endpoint that
 * detail existed nowhere at all, which meant a member whose sync had given up
 * was invisible to everyone including us.
 *
 * It is also the screen to have open during a VFT simulator session: watching
 * `last_error` arrive in real time beats reading it out of `psql`.
 *
 * Authorization is a Supabase session plus `saas_admins` membership, checked
 * before any query runs — the same non-negotiable gate as the other
 * `/system-health` surfaces.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin'
import { ResponseBuilder } from '@/utils/api/ApiResponse'
import {
  AccessSyncStatus,
  DEVICE_CLOCK_SKEW_ALERT_SECONDS,
  DEVICE_OFFLINE_AFTER_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'

/** Dead-lettered jobs returned per request. */
const JOB_LIMIT = 50

export async function GET(request: NextRequest) {
  // Strict authorization BEFORE any database query. This surface exposes raw
  // vendor errors, so the gate is not negotiable.
  const admin = await getSaasAdmin()
  if (!admin) {
    console.warn('Unauthorized admin access-control health request')
    return NextResponse.json(
      ResponseBuilder.forbidden('Forbidden - SaaS admin access required'),
      { status: 403 }
    )
  }

  try {
    const gymId = new URL(request.url).searchParams.get('gymId')
    const supabase = createAdminClient()

    let deadJobsQuery = supabase
      .from('access_sync_jobs')
      .select(
        'id, gym_id, member_id, intent, status, attempts, last_error, updated_at'
      )
      .in('status', [AccessSyncStatus.Dead, AccessSyncStatus.Failed])
      // Newest first (rule 2.10): an operator reads the top of this list.
      .order('updated_at', { ascending: false })
      .limit(JOB_LIMIT)

    if (gymId) deadJobsQuery = deadJobsQuery.eq('gym_id', gymId)

    // Counted against the table, not the page.
    //
    // `JOB_LIMIT` bounds what a human can usefully read; it must not bound the
    // number they are told. Filtering the returned page pinned both counts at
    // 50 — so an outage growing past that looked stable, which is the reverse
    // of what a health screen is for. This deployment sat at 660 dead jobs
    // while the summary said 50.
    const countQuery = (status: AccessSyncStatus) => {
      let query = supabase
        .from('access_sync_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)

      if (gymId) query = query.eq('gym_id', gymId)
      return query
    }

    let devicesQuery = supabase
      .from('access_devices')
      .select(
        'id, gym_id, device_serial, device_name, is_active, last_seen_at, clock_skew_seconds, clock_skew_measured_at, template_count, template_capacity'
      )
      .order('gym_id', { ascending: true })

    if (gymId) devicesQuery = devicesQuery.eq('gym_id', gymId)

    const [jobs, devices, deadCount, retryingCount] = await Promise.all([
      deadJobsQuery,
      devicesQuery,
      countQuery(AccessSyncStatus.Dead),
      countQuery(AccessSyncStatus.Failed),
    ])

    if (jobs.error) throw jobs.error
    if (devices.error) throw devices.error
    if (deadCount.error) throw deadCount.error
    if (retryingCount.error) throw retryingCount.error

    const deviceRows = devices.data ?? []
    const offlineThreshold = Date.now() - DEVICE_OFFLINE_AFTER_SECONDS * 1000

    return NextResponse.json(
      ResponseBuilder.success({
        // Raw vendor text, verbatim. That is the entire point of this endpoint.
        // The newest `JOB_LIMIT` rows — a page to read, not a total to count.
        jobs: jobs.data ?? [],
        jobsTruncated: (jobs.data ?? []).length >= JOB_LIMIT,
        devices: deviceRows,
        summary: {
          deadJobs: deadCount.count ?? 0,
          retryingJobs: retryingCount.count ?? 0,
          devicesTotal: deviceRows.length,
          devicesSilent: deviceRows.filter(
            (d) =>
              d.is_active &&
              (!d.last_seen_at ||
                new Date(d.last_seen_at).getTime() < offlineThreshold)
          ).length,
          devicesDrifting: deviceRows.filter(
            (d) =>
              d.clock_skew_seconds !== null &&
              Math.abs(d.clock_skew_seconds) > DEVICE_CLOCK_SKEW_ALERT_SECONDS
          ).length,
          // Readers whose capacity we have learned and that are nearly full.
          // Unknown capacity is excluded rather than counted as healthy: we
          // genuinely do not know, and saying otherwise would be a guess.
          devicesNearCapacity: deviceRows.filter(
            (d) =>
              d.template_capacity !== null &&
              d.template_capacity > 0 &&
              d.template_count / d.template_capacity >= 0.85
          ).length,
        },
      })
    )
  } catch (error) {
    console.error('Admin access-control health error:', error)
    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to load access control health',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    )
  }
}
