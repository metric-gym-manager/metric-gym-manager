/**
 * Reclaim reader capacity from members who cannot get in anyway.
 *
 * A reader holds a fixed number of fingerprint templates (1,000–3,000). A gym
 * that has churned members for a couple of years will exceed that, and once it
 * does the reader answers `-18` and new members silently stop being enrolled.
 *
 * Policy lives in `domain/EvictionPolicy.ts`; this class executes it.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import { RequestPacer } from '@/lib/access-control/rateLimit'
import type { IAccessControlRepository } from './IAccessControlRepository'
import {
  selectEvictionCandidates,
  slotsToReclaim,
} from '@/features/access-control/domain/EvictionPolicy'
import {
  DEVICE_CAPACITY_EVICT_ABOVE,
  DEVICE_CAPACITY_TARGET,
  VENDOR_MAX_REQUESTS_PER_SECOND,
} from '@/features/access-control/config/AccessControlConfig'

export interface EvictInactiveSubjectsInput {
  gymId: string
  /**
   * Free this many slots regardless of current usage.
   *
   * Used by the reactive path: a `-18` from the reader means it is full right
   * now, whatever our recorded count says.
   */
  forceSlots?: number
  /**
   * Why eviction was asked for. Decides what to do when capacity is unknown.
   *
   * `proactive` (the default) declines to act — a nightly sweep must not guess
   * at a reader's limit and evict from one with plenty of room. `manual` is a
   * person pressing a button having read a capacity warning, so a modest batch
   * is honoured rather than silently doing nothing.
   */
  reason?: 'proactive' | 'manual'
}

/**
 * Slots freed when a person asks but the reader's true capacity is unknown.
 *
 * Small on purpose. Every candidate is restorable by re-sync, but eviction
 * still costs a vendor round trip each, and a button that quietly removed
 * hundreds of members would be a surprise.
 */
const MANUAL_EVICTION_BATCH = 25

export interface EvictInactiveSubjectsSummary {
  /** False when the gym has no access control configured. */
  applicable: boolean
  evicted: number
  /**
   * Slots still needed after evicting everyone eligible.
   *
   * Non-zero is a genuine capacity problem: the reader cannot be freed without
   * removing a member who can currently enter. That needs a second reader, not
   * a bolder eviction policy.
   */
  shortfall: number
  errors: string[]
}

export class EvictInactiveSubjects {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Evict inactive members from a gym's readers.
   *
   * @param input - Gym, and optionally a forced number of slots.
   */
  async execute(
    input: EvictInactiveSubjectsInput
  ): Promise<EvictInactiveSubjectsSummary> {
    const summary: EvictInactiveSubjectsSummary = {
      applicable: false,
      evicted: 0,
      shortfall: 0,
      errors: [],
    }

    const credentials = await this.repo.getCredentials(input.gymId)
    if (!credentials) return summary

    const devices = await this.repo.listDevices(input.gymId)
    const activeDevices = devices.filter((d) => d.is_active)
    if (activeDevices.length === 0) return summary

    summary.applicable = true

    // The fullest reader sets the requirement: a member's template sits on
    // every reader the gym has, so freeing one frees all of them equally.
    const fromThresholds = Math.max(
      0,
      ...activeDevices.map((device) =>
        slotsToReclaim(
          device.template_count ?? 0,
          device.template_capacity ?? null,
          DEVICE_CAPACITY_EVICT_ABOVE,
          DEVICE_CAPACITY_TARGET
        )
      )
    )

    // A person who pressed the button after reading a capacity warning gets a
    // batch even when we do not know the reader's true limit — otherwise the
    // button does nothing at all on every reader whose capacity has not yet
    // been learned, which is all of them until one reports itself full.
    const capacityUnknown = activeDevices.every(
      (device) => device.template_capacity === null
    )

    const needed =
      input.forceSlots ??
      (fromThresholds > 0
        ? fromThresholds
        : input.reason === 'manual' && capacityUnknown
          ? MANUAL_EVICTION_BATCH
          : 0)

    if (needed <= 0) return summary

    const candidates = await this.repo.listEvictionCandidates(input.gymId)
    const selection = selectEvictionCandidates(
      candidates.map((c) => ({
        memberId: c.memberId,
        subjectId: c.subjectId,
        status: c.status,
        nextDueDate: c.nextDueDate,
      })),
      needed
    )

    summary.shortfall = selection.shortfall

    const pacer = new RequestPacer(VENDOR_MAX_REQUESTS_PER_SECOND)

    for (const candidate of selection.evict) {
      await pacer.wait()

      try {
        // `revokeBiometrics` is fromdev: the template leaves the reader, the
        // vendor keeps its central copy. That is what makes this reversible
        // without the member ever returning to the scanner.
        const outcome = await this.provider.revokeBiometrics(
          credentials,
          String(candidate.subjectId)
        )

        if (outcome.status === 'failed') {
          summary.errors.push(outcome.error)
          continue
        }

        await this.repo.markSubjectOffDevice(candidate.memberId)
        summary.evicted += 1
      } catch (error) {
        summary.errors.push(
          error instanceof Error ? error.message : 'Unknown eviction error'
        )
      }
    }

    // Recount from the database rather than subtracting, so the stored count
    // cannot drift away from reality after a partial run.
    for (const device of activeDevices) {
      try {
        await this.repo.recountDeviceTemplates(device.id)
      } catch (error) {
        summary.errors.push(
          error instanceof Error ? error.message : 'Failed to recount templates'
        )
      }
    }

    return summary
  }
}
