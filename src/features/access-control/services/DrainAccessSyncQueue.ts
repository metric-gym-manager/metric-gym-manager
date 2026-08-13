/**
 * The outbox worker.
 *
 * Everything that reaches the hardware goes through here, which is what makes
 * retry, pacing and failure classification exist in exactly one place.
 *
 * ## Order of operations
 *
 * Reclaim first, then claim. A drain invocation killed mid-run (serverless
 * timeout, deploy, OOM) leaves its jobs `in_flight`, and the claim function
 * only picks up `pending` and `failed` — so without the reclaim those members
 * would never sync again and nothing would say so. Every run heals the
 * previous run's casualties.
 *
 * ## What this deliberately does not do
 *
 * Serialization per member is enforced by `claim_access_sync_jobs`, not here.
 * A member's commands have a mandatory order (the subject must reach the
 * device before a validity period binds to it), and only the database can make
 * that race-free across overlapping invocations.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import { RequestPacer } from '@/lib/access-control/rateLimit'
import type { IAccessControlRepository } from './IAccessControlRepository'
import type { SyncMemberAccess, SyncFailure } from './SyncMemberAccess'
import type { OperateDevice } from './OperateDevice'
import type { EvictInactiveSubjects } from './EvictInactiveSubjects'
import {
  AccessIntent,
  AccessSyncStatus,
  DRAIN_BATCH_SIZE,
  STALE_JOB_RECLAIM_SECONDS,
  VENDOR_MAX_REQUESTS_PER_SECOND,
} from '@/features/access-control/config/AccessControlConfig'

export interface DrainAccessSyncQueueInput {
  /** Jobs to claim this run. */
  limit?: number
  /** Calendar day to decide against. Injectable for tests. */
  today?: Date
}

export interface DrainAccessSyncQueueSummary {
  reclaimed: number
  claimed: number
  succeeded: number
  /** Failed but rescheduled. */
  retrying: number
  /** Retry budget spent, or a failure that will never succeed on retry. */
  deadLettered: number
  /** Dead-lettered failures that need a person — a full reader, for example. */
  needingAttention: number
  /** Slots reclaimed after a reader reported itself full. */
  evicted: number
  errors: string[]
}

/**
 * Vendor return code for "the device has insufficient space".
 *
 * Singled out because it is the one failure the system can resolve on its own:
 * a full reader is a capacity problem, and we hold a policy for reclaiming
 * capacity from members who cannot get in anyway.
 */
const DEVICE_STORAGE_FULL = -18

/**
 * Slots to reclaim when a reader reports itself full.
 *
 * More than the one the blocked member needs, so a gym churning members does
 * not hit `-18` again on the very next enrolment and pay another round trip
 * for every single one.
 */
const EVICTION_BATCH_ON_FULL = 25

export class DrainAccessSyncQueue {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly syncMember: SyncMemberAccess,
    private readonly operateDevice: OperateDevice,
    private readonly evictSubjects: EvictInactiveSubjects,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Drain one batch.
   *
   * @param input - Batch size and the calendar day to decide against.
   * @returns What happened, for the cron audit log.
   */
  async execute(
    input: DrainAccessSyncQueueInput = {}
  ): Promise<DrainAccessSyncQueueSummary> {
    const summary: DrainAccessSyncQueueSummary = {
      reclaimed: 0,
      claimed: 0,
      succeeded: 0,
      retrying: 0,
      deadLettered: 0,
      needingAttention: 0,
      evicted: 0,
      errors: [],
    }

    summary.reclaimed = await this.repo.reclaimStaleJobs(
      STALE_JOB_RECLAIM_SECONDS
    )

    const jobs = await this.repo.claimDueJobs(input.limit ?? DRAIN_BATCH_SIZE)
    summary.claimed = jobs.length

    if (jobs.length === 0) return summary

    const pacer = new RequestPacer(VENDOR_MAX_REQUESTS_PER_SECOND)

    for (const job of jobs) {
      await pacer.wait()

      // One job's failure must never end the batch — the whole point of
      // claiming several is that they are independent.
      try {
        const failures = await this.runJob(job, input.today)

        if (failures.length === 0) {
          await this.repo.completeJob(job.id, AccessSyncStatus.Succeeded)
          summary.succeeded += 1
          continue
        }

        await this.settleFailure(job.id, failures[0], summary, job.gym_id)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown drain error'

        summary.errors.push(message)
        await this.repo.failJob(job.id, message, true)
        summary.retrying += 1
      }
    }

    return summary
  }

  /**
   * Run one job and report what failed.
   *
   * Device-level intents carry no member; member intents route through
   * `SyncMemberAccess`, which re-derives from current state and is therefore
   * safe to repeat after a partial failure.
   */
  private async runJob(
    job: {
      id: string
      gym_id: string
      member_id: string | null
      intent: string
      payload: Record<string, unknown>
    },
    today?: Date
  ): Promise<SyncFailure[]> {
    if (
      job.intent === AccessIntent.OpenDoor ||
      job.intent === AccessIntent.RebootDevice
    ) {
      // Device operations dispatch inline at request time so staff get
      // immediate feedback; the queued row exists for the audit trail. Nothing
      // to re-send here.
      if (job.payload?.dispatchedInline === true) return []

      const deviceId = String(job.payload?.deviceId ?? '')
      const actorId = String(job.payload?.actorId ?? 'system')

      const result =
        job.intent === AccessIntent.OpenDoor
          ? await this.operateDevice.openDoor({
              gymId: job.gym_id,
              deviceId,
              actorId,
            })
          : await this.operateDevice.reboot({
              gymId: job.gym_id,
              deviceId,
              actorId,
            })

      return result.error
        ? [
            {
              message: result.error,
              retryable: true,
              needsAttention: false,
            },
          ]
        : []
    }

    if (!job.member_id) {
      return [
        {
          message: `Job ${job.id} has intent ${job.intent} but no member`,
          retryable: false,
          needsAttention: true,
        },
      ]
    }

    const result = await this.syncMember.execute({
      memberId: job.member_id,
      today,
    })

    return result.failures
  }

  /** Decide whether a failure is rescheduled or dead-lettered, and record it. */
  private async settleFailure(
    jobId: string,
    failure: SyncFailure,
    summary: DrainAccessSyncQueueSummary,
    gymId: string
  ): Promise<void> {
    // A full reader is the one failure we can act on rather than merely
    // report. Reclaim capacity from members who cannot get in anyway, then
    // reschedule — so the member who triggered it gets on at the next pass
    // instead of waiting for someone to notice a dead-lettered job.
    if (failure.returnCode === DEVICE_STORAGE_FULL) {
      const freed = await this.freeCapacity(gymId, summary)

      if (freed > 0) {
        await this.repo.failJob(jobId, failure.message, true)
        summary.retrying += 1
        return
      }
      // Nothing could be freed: every remaining member on the reader can
      // currently enter. That is a second-reader conversation, so it falls
      // through to dead-letter and a person is told.
    }

    // A retryable failure goes back with backoff; anything else stops here.
    // Retrying a permanent failure — an unsupported command, a reader we could
    // not free — burns quota and buries the real problem behind noise.
    const retryable = failure.retryable && !failure.needsAttention

    await this.repo.failJob(jobId, failure.message, retryable)

    if (retryable) {
      summary.retrying += 1
      return
    }

    summary.deadLettered += 1
    if (failure.needsAttention) {
      summary.needingAttention += 1
    }
    summary.errors.push(failure.message)
  }

  /**
   * Reclaim reader slots after a device reported itself full.
   *
   * Also the moment the system **learns the reader's real capacity**: "full"
   * means the current template count is the limit, and until we know that
   * number the proactive capacity check cannot fire at all, because
   * `slotsToReclaim` refuses to guess at an unknown capacity.
   *
   * @returns Slots actually freed.
   */
  private async freeCapacity(
    gymId: string,
    summary: DrainAccessSyncQueueSummary
  ): Promise<number> {
    try {
      const devices = await this.repo.listDevices(gymId)

      for (const device of devices.filter((d) => d.is_active)) {
        if (device.template_capacity === null && device.template_count > 0) {
          await this.repo.recordDeviceCapacity(
            device.device_serial,
            device.template_count
          )
        }
      }

      const result = await this.evictSubjects.execute({
        gymId,
        // The reader is full right now, whatever our recorded count says, so
        // the usage-fraction thresholds are bypassed in favour of a concrete
        // ask: free enough for this member and a little headroom.
        forceSlots: EVICTION_BATCH_ON_FULL,
      })

      summary.evicted += result.evicted
      summary.errors.push(...result.errors)

      return result.evicted
    } catch (error) {
      summary.errors.push(
        `Capacity reclamation failed for gym ${gymId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
      return 0
    }
  }

  /** Provider name, for the cron log. */
  getProviderName(): string {
    return this.provider.getProviderName()
  }
}
