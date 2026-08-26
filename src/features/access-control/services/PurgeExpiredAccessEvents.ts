/**
 * Deleting door scans once they are past their retention period.
 *
 * ## Why this exists at all
 *
 * `access_events` records that a named person was at a named door at a named
 * minute. Kept indefinitely — which is what happened until this job existed —
 * that is a movement history of every member of every gym on the platform,
 * accumulating forever for no purpose anybody asked for. Nothing in the
 * product reads an event older than the activity log's own paging.
 *
 * ## Platform-wide, not per gym
 *
 * Retention is a promise made to members in the privacy policy, not a setting
 * a gym can lengthen. So there is one number, `ACCESS_EVENT_RETENTION_DAYS`,
 * and this sweeps every gym with it.
 *
 * ## Why it runs daily rather than monthly
 *
 * The policy states twelve months. A monthly sweep would let the oldest data
 * reach thirteen before anything touched it, which quietly makes the published
 * figure untrue for a month at a time. A daily pass costs one indexed query on
 * the nights it finds nothing, which is most of them.
 */

import {
  ACCESS_EVENT_PURGE_BATCH_SIZE,
  ACCESS_EVENT_PURGE_MAX_BATCHES,
  ACCESS_EVENT_RETENTION_DAYS,
} from '@/features/access-control/config/AccessControlConfig'
import type { IAccessControlRepository } from './IAccessControlRepository'

export interface PurgeExpiredAccessEventsSummary {
  /** Rows removed by this run. */
  deleted: number
  /** The boundary used, as an ISO timestamp. Anything older than this went. */
  cutoff: string
  /**
   * True when the batch cap stopped the run with work still outstanding.
   *
   * Reported rather than hidden because it is the difference between "there
   * was nothing to do" and "there was too much to do" — and if it is still
   * true after several nights, the cap or the schedule is wrong.
   */
  backlogRemaining: boolean
}

export class PurgeExpiredAccessEvents {
  constructor(private readonly repo: IAccessControlRepository) {}

  /**
   * Delete every scan older than the retention window.
   *
   * @param now - Clock reading the cutoff is measured back from. Injectable so
   *   the boundary is testable without waiting a year.
   * @returns What was removed, and whether a backlog was left behind.
   */
  async execute(
    now: Date = new Date()
  ): Promise<PurgeExpiredAccessEventsSummary> {
    const cutoff = new Date(
      now.getTime() - ACCESS_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    )

    let deleted = 0

    for (let batch = 0; batch < ACCESS_EVENT_PURGE_MAX_BATCHES; batch += 1) {
      const removed = await this.repo.deleteEventsOlderThan(
        cutoff,
        ACCESS_EVENT_PURGE_BATCH_SIZE
      )

      deleted += removed

      // A short batch means the backlog is exhausted: the query asks for a
      // full batch of rows older than the cutoff and got fewer, so there are
      // no more to find. Checking this rather than `removed === 0` saves a
      // final round trip on every run that had anything to do.
      if (removed < ACCESS_EVENT_PURGE_BATCH_SIZE) {
        return {
          deleted,
          cutoff: cutoff.toISOString(),
          backlogRemaining: false,
        }
      }
    }

    return { deleted, cutoff: cutoff.toISOString(), backlogRemaining: true }
  }
}
