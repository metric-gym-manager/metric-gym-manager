/**
 * Retention for door scans.
 *
 * `access_events` records that a named person was at a named door at a named
 * minute. Kept forever — which is what happened before this job existed — that
 * is an indefinite movement history of every member on the platform. The
 * privacy policy now names a figure, so what these tests hold is that the
 * figure is true: the boundary is measured from the stated number of days, the
 * cut is taken from the old end, and a backlog too large for one run says so
 * rather than silently doing part of the job and reporting success.
 */

import { PurgeExpiredAccessEvents } from '@/features/access-control/services/PurgeExpiredAccessEvents'
import {
  ACCESS_EVENT_PURGE_BATCH_SIZE,
  ACCESS_EVENT_PURGE_MAX_BATCHES,
  ACCESS_EVENT_RETENTION_DAYS,
} from '@/features/access-control/config/AccessControlConfig'
import type { AccessEvent } from '@/features/access-control/types'
import { FakeAccessControlRepository } from './fakes'

const NOW = new Date('2026-08-26T02:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

function makeEvent(occurredAt: Date, index: number): AccessEvent {
  return {
    id: `event-${index}`,
    gym_id: 'gym-1',
    member_id: 'member-1',
    device_serial: 'SER-001',
    subject_id: 100001,
    occurred_at: occurredAt.toISOString(),
    verify_type: 1,
    checking_status: 0,
    event_code: '0',
    raw: {},
    created_at: occurredAt.toISOString(),
  }
}

/** `count` events, each one day older than the last, starting `daysAgo` back. */
function agedEvents(count: number, daysAgo: number): AccessEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent(new Date(NOW.getTime() - (daysAgo + i) * DAY_MS), i)
  )
}

describe('PurgeExpiredAccessEvents', () => {
  it('deletes events older than the retention window', async () => {
    const events = agedEvents(3, ACCESS_EVENT_RETENTION_DAYS + 1)
    const repo = new FakeAccessControlRepository({ events })

    const summary = await new PurgeExpiredAccessEvents(repo).execute(NOW)

    expect(summary.deleted).toBe(3)
    expect(events).toHaveLength(0)
  })

  it('keeps events inside the retention window', async () => {
    const events = agedEvents(5, 30)
    const repo = new FakeAccessControlRepository({ events })

    const summary = await new PurgeExpiredAccessEvents(repo).execute(NOW)

    expect(summary.deleted).toBe(0)
    expect(events).toHaveLength(5)
  })

  it('measures the cutoff from the configured number of days', async () => {
    const repo = new FakeAccessControlRepository({ events: [] })

    const summary = await new PurgeExpiredAccessEvents(repo).execute(NOW)

    const expected = new Date(
      NOW.getTime() - ACCESS_EVENT_RETENTION_DAYS * DAY_MS
    )

    expect(summary.cutoff).toBe(expected.toISOString())
    // The promise in the privacy policy is this number. If the constant moves,
    // the published figure has to move with it.
    expect(ACCESS_EVENT_RETENTION_DAYS).toBe(365)
  })

  it('spares an event that is one day short of the boundary', async () => {
    // The boundary itself is where an off-by-one deletes data a member was
    // told would still be there.
    const events = [
      makeEvent(
        new Date(NOW.getTime() - (ACCESS_EVENT_RETENTION_DAYS - 1) * DAY_MS),
        0
      ),
    ]

    const repo = new FakeAccessControlRepository({ events })

    const summary = await new PurgeExpiredAccessEvents(repo).execute(NOW)

    expect(summary.deleted).toBe(0)
    expect(events).toHaveLength(1)
  })

  it('works through a backlog in batches', async () => {
    const total = ACCESS_EVENT_PURGE_BATCH_SIZE * 2 + 10
    const events = agedEvents(total, ACCESS_EVENT_RETENTION_DAYS + 1)
    const repo = new FakeAccessControlRepository({ events })

    const summary = await new PurgeExpiredAccessEvents(repo).execute(NOW)

    expect(summary.deleted).toBe(total)
    expect(summary.backlogRemaining).toBe(false)
    expect(events).toHaveLength(0)
    // Three passes: two full batches and a short one that ends the run.
    expect(repo.purgeCalls).toHaveLength(3)
    expect(repo.purgeCalls[0].limit).toBe(ACCESS_EVENT_PURGE_BATCH_SIZE)
  })

  it('stops after one round trip when there is nothing to delete', async () => {
    const repo = new FakeAccessControlRepository({ events: [] })

    await new PurgeExpiredAccessEvents(repo).execute(NOW)

    // Most nights are this one. It must not cost a second query.
    expect(repo.purgeCalls).toHaveLength(1)
  })

  it('reports a remaining backlog rather than running past the cap', async () => {
    // Every call returns a full batch, so the run can never conclude the
    // backlog is exhausted — exactly the shape that would spin forever inside
    // a cron invocation if the cap were not there.
    const repo = new FakeAccessControlRepository({ events: [] })
    repo.deleteEventsOlderThan = async () => ACCESS_EVENT_PURGE_BATCH_SIZE

    const summary = await new PurgeExpiredAccessEvents(repo).execute(NOW)

    expect(summary.backlogRemaining).toBe(true)
    expect(summary.deleted).toBe(
      ACCESS_EVENT_PURGE_BATCH_SIZE * ACCESS_EVENT_PURGE_MAX_BATCHES
    )
  })

  it('takes each bounded batch from the old end first', async () => {
    // The contract the batching depends on, tested where it lives: a bounded
    // delete must take the *oldest* rows, so repeated calls walk forward
    // through a backlog instead of re-reading an arbitrary slice of it.
    const oldest = makeEvent(
      new Date(NOW.getTime() - (ACCESS_EVENT_RETENTION_DAYS + 100) * DAY_MS),
      0
    )
    const newerButStillExpired = makeEvent(
      new Date(NOW.getTime() - (ACCESS_EVENT_RETENTION_DAYS + 1) * DAY_MS),
      1
    )

    // Deliberately stored newest-first, so an implementation that just took
    // the head of the array would pick the wrong one.
    const events = [newerButStillExpired, oldest]
    const repo = new FakeAccessControlRepository({ events })

    const cutoff = new Date(
      NOW.getTime() - ACCESS_EVENT_RETENTION_DAYS * DAY_MS
    )

    expect(await repo.deleteEventsOlderThan(cutoff, 1)).toBe(1)
    expect(events).toEqual([newerButStillExpired])

    expect(await repo.deleteEventsOlderThan(cutoff, 1)).toBe(1)
    expect(events).toHaveLength(0)
  })
})
