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
 *
 * ## What it diffs against
 *
 * The **vendor's own account of the state**, not our record of what we last
 * sent. `GET /api/template` carries `StartDate`, `EndDate` and `IsSync` per
 * subject — measured on the live account 2026-09-23, `YYYYMMDD` strings
 * exactly as pushed — so one call per gym answers "what does the vendor
 * actually hold?".
 *
 * That matters because audit Y1 showed our record failing in the direction
 * nothing could notice: a duplicate command misread as a permanent failure
 * meant the write-back never ran, leaving two members correct on the reader
 * and blocked in our database. A diff whose two sides are both our own record
 * agrees with itself no matter how wrong it is.
 *
 * Three things the vendor cannot answer, which still come from our record:
 *
 *  - **Blocked.** There is no block field on the subject (19 fields, none of
 *    them it), so a block is diffed against `last_synced_blocked` as before.
 *  - **An unreadable answer.** `listSubjects` returns `[]` for a payload it
 *    cannot parse — that is how an account with two readers once reported
 *    none. Read as "the vendor holds nobody", an empty list would enqueue
 *    every provisioned member of every gym: the exact stampede the diff
 *    exists to prevent. Empty or failed therefore falls back to the local
 *    comparison, which is strictly the old behaviour.
 *  - **Per-reader placement.** The window is central to the account; which
 *    terminal holds the template stays ours to track.
 */

import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig'
import { isFeatureEnabled } from '@/features/subscriptions/domain/PlanRestrictions'
import type { IGymSubscriptionRepository } from '@/features/subscriptions/services/IGymSubscriptionRepository'
import type { IAccessControlRepository } from './IAccessControlRepository'
import type { EvictInactiveSubjects } from './EvictInactiveSubjects'
import type {
  AccessSubjectInfo,
  IAccessControlProvider,
} from '@/lib/access-control'
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
  /**
   * Reader slots reclaimed by the proactive capacity sweep.
   *
   * Only ever non-zero for a gym whose reader capacity is already known — and
   * capacity is only learned from a reader refusing an enrolment. So this stays
   * at zero until the reactive path has fired at least once, which is correct
   * rather than a bug: guessing a limit could evict members from a reader with
   * plenty of room.
   */
  slotsReclaimed: number
  /**
   * Members the **vendor** contradicted.
   *
   * Either it holds a subject we have no record of ever pushing, or it holds a
   * different window for one our own diff called settled. The number worth
   * watching: it means something wrote to the hardware without us recording it
   * — or, more likely, that a write-back of ours was lost.
   */
  vendorDrift: number
  /**
   * Members skipped because no command could change anything for them.
   *
   * A member who may not enter, is on no reader and was never provisioned:
   * `deriveAccessCommands` answers with nothing, so enqueueing them produces a
   * job that succeeds, writes nothing and leaves the diff exactly as it was —
   * which then enqueues them again the next run, forever (F35, measured in
   * production).
   *
   * Counted rather than silently dropped, because "we looked at 300 members
   * and 40 of them have no hardware state at all" is a fact about a gym, and
   * because a number that moves is how anyone would notice this rule starting
   * to skip the wrong people.
   */
  membersNothingToDo: number
  /**
   * Gyms whose subjects the vendor would not tell us about this run.
   *
   * They fall back to the local diff rather than being skipped, so this is not
   * an error — but a gym that is permanently here is reconciling blind against
   * its own record, which is what F28 set out to stop.
   */
  gymsVendorUnreadable: number
  errors: string[]
}

export class ReconcileMemberAccess {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly gymSubscriptionRepo: IGymSubscriptionRepository,
    private readonly evictSubjects: EvictInactiveSubjects,
    private readonly provider: IAccessControlProvider
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
      slotsReclaimed: 0,
      vendorDrift: 0,
      membersNothingToDo: 0,
      gymsVendorUnreadable: 0,
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

        const vendorSubjects = await this.readVendorState(gymId, subjects)
        if (!vendorSubjects) summary.gymsVendorUnreadable += 1

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
          const vendorRecord = vendorSubjects?.get(String(current.subject_id))

          // The vendor holding someone we have no record of pushing is a
          // contradiction, not housekeeping — the Y1 shape, our record and the
          // hardware having parted company. It must never be filed under
          // "nothing to do" merely because today's sync cannot fix it alone.
          const unrecordedAtVendor =
            vendorRecord !== undefined && !current.provisioned_at

          // A member no command could change is skipped rather than queued.
          // See `hasNoHardwareWork` — enqueueing them is a job that succeeds,
          // writes nothing, and leaves this same diff behind for tomorrow.
          if (this.hasNoHardwareWork(decision.allowed, current)) {
            if (!unrecordedAtVendor) {
              summary.membersNothingToDo += 1
              continue
            }
          }

          // Blocked is ours either way: the vendor exposes no such field.
          const blockMatches = current.last_synced_blocked === desiredBlocked

          const localWindowMatches =
            normaliseDate(current.last_synced_valid_from) === desiredFrom &&
            normaliseDate(current.last_synced_valid_to) === desiredTo

          const windowMatches = vendorSubjects
            ? this.vendorAgrees(vendorRecord, current, desiredFrom, desiredTo)
            : localWindowMatches

          if (windowMatches && blockMatches && !unrecordedAtVendor) continue

          // Drift: the vendor contradicted us, either by holding a member we
          // never recorded pushing, or by holding a different window for one
          // our own record called settled.
          if (
            unrecordedAtVendor ||
            (vendorSubjects &&
              !windowMatches &&
              blockMatches &&
              localWindowMatches)
          ) {
            summary.vendorDrift += 1
          }

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

        // Capacity housekeeping, after the diff rather than before it: a
        // member whose access changed tonight should be queued even if the
        // reader turns out to be full, so the drainer's own reactive path can
        // deal with that and the two mechanisms cannot fight over the same
        // slots in the same run.
        const eviction = await this.evictSubjects.execute({ gymId })
        summary.slotsReclaimed += eviction.evicted
        summary.errors.push(...eviction.errors)
      } catch (error) {
        summary.errors.push(
          `Gym ${gymId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return summary
  }

  /**
   * Whether the hardware has nothing that could be asked of it for this member.
   *
   * Mirrors `deriveAccessCommands`' own first answer: a member who may not
   * enter and was never provisioned gets no commands at all, because
   * provisioning someone purely in order to block them costs three API calls
   * and creates a record the capacity policy then has to claw back.
   *
   * Deliberately **stricter** than that branch — it also requires that no
   * reader is holding the member. Serials without a provisioning timestamp
   * should not exist, but if that state ever occurs the member is on a reader
   * and may not enter, and the conservative answer is to queue the work rather
   * than to declare there is none. Every member skipped here is therefore one
   * the sync would provably do nothing for, and the relationship is pinned by
   * a test that asserts `deriveAccessCommands` returns nothing for this shape.
   *
   * @param allowed - Whether the access decision lets them in.
   * @param subject - Our subject row for the member.
   */
  private hasNoHardwareWork(
    allowed: boolean,
    subject: {
      provisioned_at: string | null
      synced_device_serials: string[]
    }
  ): boolean {
    return (
      !allowed &&
      !subject.provisioned_at &&
      (subject.synced_device_serials ?? []).length === 0
    )
  }

  /**
   * What the vendor holds for this gym's subjects, or `null` if it will not
   * say.
   *
   * One call per gym, never one per member — the reconcile's whole economy is
   * that vendor traffic stays proportional to real changes.
   *
   * Returns `null` rather than an empty map for every "we could not read it"
   * case, so the caller cannot accidentally treat silence as "the vendor holds
   * nobody". A failure is not an error on the summary either: falling back to
   * the local diff is exactly the behaviour that shipped before this, so a
   * vendor outage must not make the nightly log look broken.
   */
  private async readVendorState(
    gymId: string,
    subjects: Array<{ subject: unknown }>
  ): Promise<Map<string, AccessSubjectInfo> | null> {
    // Nothing provisioned: there is nothing to compare, and a call would be
    // one HTTP request to learn that.
    if (!subjects.some((context) => context.subject)) return null

    try {
      const credentials = await this.repo.getCredentials(gymId)
      if (!credentials) return null

      const vendorSubjects = await this.provider.listSubjects(credentials)
      if (vendorSubjects.length === 0) return null

      // Indexed by id, deliberately. The account is shared, so this list can
      // hold other companies' people; the only safe use of it is a lookup of
      // an id WE allocated, never a scan of their rows.
      return new Map(vendorSubjects.map((s) => [String(s.subjectId), s]))
    } catch {
      return null
    }
  }

  /**
   * Whether the vendor's own record matches what the member should have.
   *
   * @param vendorRecord - The subject as the vendor holds it, if at all.
   * @param current - Our subject row, for the "is anyone meant to hold them"
   *   question `IsSync` is judged against.
   * @param desiredFrom - `YYYYMMDD` the window should start.
   * @param desiredTo - `YYYYMMDD` the window should end.
   */
  private vendorAgrees(
    vendorRecord: AccessSubjectInfo | undefined,
    current: { synced_device_serials: string[] },
    desiredFrom: string | null,
    desiredTo: string | null
  ): boolean {
    // We believe this member is provisioned and the vendor has never heard of
    // them — or has deleted them. Either way the record has to be re-asserted.
    if (!vendorRecord) return false
    if (vendorRecord.deleted === true) return false

    if (normaliseDate(vendorRecord.validFrom ?? null) !== desiredFrom) {
      return false
    }
    if (normaliseDate(vendorRecord.validTo ?? null) !== desiredTo) return false

    // `IsSync` is read only as a CONTRADICTION of our own record. The vendor
    // saying a member is not distributed, when we also believe no reader holds
    // them, is two sources agreeing — a cancelled member is off every reader on
    // purpose. Treating a bare `IsSync: 0` as drift would re-push them nightly
    // for ever, and the field's exact semantics are inferred rather than
    // documented (observed only as `1`, on subjects that are indeed synced).
    if (
      vendorRecord.syncedToVendor === false &&
      current.synced_device_serials.length > 0
    ) {
      return false
    }

    return true
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
 * Normalise a date to the device's `YYYYMMDD` form for comparison.
 *
 * Our column holds `2026-01-15`; the device and the vendor's subject record
 * both want `20260115`. Comparing the two raw would report every member as
 * changed, every night. Applied to the vendor's value as well — it arrives
 * already in device form, but normalising both sides costs nothing and means
 * a build that starts sending `2026-01-15` cannot silently re-push the whole
 * gym.
 */
function normaliseDate(value: string | null): string | null {
  if (!value) return null
  return value.slice(0, 10).replace(/-/g, '')
}
