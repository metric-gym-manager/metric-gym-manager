/**
 * The nightly reconcile.
 *
 * Runs at local midnight and enqueues work for members whose access has
 * actually changed — chiefly the ones expiring at that exact moment.
 *
 * ## Why it diffs instead of re-asserting
 *
 * The vendor has no bulk validity endpoint: re-pushing a window is one HTTP
 * call per member per device. Blindly refreshing a 500-member gym nightly
 * would be 500 calls to change nothing.
 *
 * It is also not merely wasteful. Every `validperiod` write is another chance
 * for firmware to disturb an existing block, so writing only where something
 * changed shrinks the surface of that hazard as well.
 *
 * ## Why skipping a gym is safe
 *
 * A gym whose own subscription has lapsed is skipped entirely. That mirrors
 * `SendAutomatedReminders.resolveAllowedGyms`, but note the *effect* is the
 * opposite: not sending an SMS means the member hears nothing, whereas not
 * syncing means every member keeps the access they already have. Their doors
 * carry on working from the reader's own records.
 *
 * That is the confirmed product decision — a gym's billing dispute must not
 * lock out members who paid — and it holds precisely because the device is the
 * authority rather than us.
 */

import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig'
import { isFeatureEnabled } from '@/features/subscriptions/domain/PlanRestrictions'
import type { IGymSubscriptionRepository } from '@/features/subscriptions/services/IGymSubscriptionRepository'
import type { IAccessControlRepository } from './IAccessControlRepository'
import { resolveAccessDecision } from '@/features/access-control/domain/AccessDecision'
import {
  formatDeviceDate,
  getGymToday,
} from '@/features/access-control/utils/getGymToday'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'

export interface ReconcileMemberAccessInput {
  /** Limit to one gym. Omit to sweep all of them. */
  gymId?: string
  /** Gym-local calendar day. Injectable for tests. */
  today?: Date
}

export interface ReconcileMemberAccessSummary {
  gymsConsidered: number
  /** Skipped because the gym's own subscription is not in good standing. */
  gymsSkippedBilling: number
  /**
   * Skipped because the gym's plan no longer includes door hardware.
   *
   * Counted separately from a billing lapse: one is "pay your bill", the other
   * is "you downgraded", and an operator reading the cron log needs to tell
   * them apart.
   */
  gymsSkippedNotEntitled: number
  membersChecked: number
  /** Members whose hardware state no longer matches their access. */
  membersEnqueued: number
  errors: string[]
}

export class ReconcileMemberAccess {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly gymSubscriptionRepo: IGymSubscriptionRepository
  ) {}

  /**
   * Sweep gyms and enqueue members whose access has changed.
   *
   * @param input - Optional single gym, and the calendar day to decide against.
   */
  async execute(
    input: ReconcileMemberAccessInput = {}
  ): Promise<ReconcileMemberAccessSummary> {
    const summary: ReconcileMemberAccessSummary = {
      gymsConsidered: 0,
      gymsSkippedBilling: 0,
      gymsSkippedNotEntitled: 0,
      membersChecked: 0,
      membersEnqueued: 0,
      errors: [],
    }

    const today = input.today ?? getGymToday()

    const gymIds = input.gymId
      ? [input.gymId]
      : await this.repo.listGymsWithAccessControl()

    summary.gymsConsidered = gymIds.length

    for (const gymId of gymIds) {
      // One gym's failure must not stop the sweep — the others are unrelated.
      try {
        const standing = await this.resolveStanding(gymId)

        if (standing !== 'ok') {
          summary[
            standing === 'not_entitled'
              ? 'gymsSkippedNotEntitled'
              : 'gymsSkippedBilling'
          ] += 1
          continue
        }

        const subjects = await this.repo.listSubjectsForReconcile(gymId)
        summary.membersChecked += subjects.length

        for (const context of subjects) {
          if (!context.subject) continue

          const decision = resolveAccessDecision({
            status: context.status,
            membershipStartDate: context.membershipStartDate,
            nextDueDate: context.nextDueDate,
            registrationSource: context.registrationSource,
            verifiedAt: context.verifiedAt,
            today,
          })

          const desiredFrom = decision.validFrom
            ? formatDeviceDate(decision.validFrom)
            : null
          const desiredTo = decision.validTo
            ? formatDeviceDate(decision.validTo)
            : null
          const desiredBlocked = !decision.allowed

          const current = context.subject
          const matches =
            normaliseDate(current.last_synced_valid_from) === desiredFrom &&
            normaliseDate(current.last_synced_valid_to) === desiredTo &&
            current.last_synced_blocked === desiredBlocked

          if (matches) continue

          // Enqueue rather than sync inline: the drainer owns pacing, retry
          // and failure classification, and having one path to the hardware is
          // what keeps those consistent.
          await this.repo.enqueue(
            gymId,
            context.memberId,
            AccessIntent.ReconcileMember,
            { reason: 'nightly_reconcile' }
          )

          summary.membersEnqueued += 1
        }
      } catch (error) {
        summary.errors.push(
          `Gym ${gymId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return summary
  }

  /**
   * Whether a gym's own subscription permits us to keep pushing changes.
   *
   * Two independent questions, because they fail for different reasons and an
   * operator needs to tell them apart:
   *
   *  - **Entitlement.** Door hardware is an Enterprise capability. A gym that
   *    downgrades keeps its devices registered and its account row, so without
   *    this check the cron would carry on syncing hardware the API refuses to
   *    let them touch — the schedule quietly granting what every route denies.
   *  - **Standing.** A lapsed subscription stops the sync.
   *
   * Both fail closed, and closed is safe here: we stop pushing changes, which
   * leaves every member's existing access intact rather than removing it.
   */
  private async resolveStanding(
    gymId: string
  ): Promise<'ok' | 'not_entitled' | 'lapsed'> {
    const sub = await this.gymSubscriptionRepo.findByGymId(gymId)
    if (!sub) return 'lapsed'

    if (!isFeatureEnabled(sub.tier, 'accessControlHardware')) {
      return 'not_entitled'
    }

    const now = new Date()

    const inGoodStanding =
      sub.status === SaasStatus.Trialing ||
      sub.status === SaasStatus.Active ||
      (sub.status === SaasStatus.PastDue && !sub.isGraceExpired(now)) ||
      (sub.status === SaasStatus.Canceled && sub.isPaidThrough(now))

    return inGoodStanding ? 'ok' : 'lapsed'
  }
}

/**
 * Normalise a stored `DATE` to the device's `YYYYMMDD` form for comparison.
 *
 * The column holds `2026-01-15`; the device wants `20260115`. Comparing the
 * two raw would report every member as changed, every night.
 */
function normaliseDate(value: string | null): string | null {
  if (!value) return null
  return value.slice(0, 10).replace(/-/g, '')
}
