/**
 * Which members give up their place on a full reader.
 *
 * Pure, like every other policy decision in this feature, so the ordering can
 * be proved without a database or a terminal.
 *
 * ## The principle
 *
 * **A reader slot is only worth spending on someone who can actually get in.**
 *
 * Every candidate here already resolves to `allowed: false`, so eviction takes
 * away nothing that was granting access. It is reclamation, not restriction.
 *
 * ## Why this is acceptable at all
 *
 * The vendor keeps templates centrally, and removing one from a reader
 * (`fromdev`) leaves that central copy intact. A member evicted today and
 * returning next year is restored by a plain re-sync — they never touch the
 * scanner again. Without that property this policy would be a
 * customer-service problem rather than housekeeping.
 */

import { MemberStatus } from '@/features/members/config/StatusConfig'

/** A member currently occupying a slot who could give it up. */
export interface EvictableSubject {
  memberId: string
  subjectId: number
  status: MemberStatus
  /** Paid-through date. How long ago it passed sets the queue order. */
  nextDueDate: Date
}

export interface EvictionSelection {
  /** Members to remove from the reader, in the order to remove them. */
  evict: EvictableSubject[]
  /**
   * Slots still needed after evicting everything eligible.
   *
   * Non-zero means the reader cannot be freed without touching a member who
   * can currently enter — which is a hardware capacity problem, not something
   * to solve by locking out someone who paid.
   */
  shortfall: number
}

/**
 * Rank for the eviction queue. Lower goes first.
 *
 * Cancelled memberships are the least likely to return, so they surrender
 * their slot before an expired member who may pay next week.
 */
function statusRank(status: MemberStatus): number {
  switch (status) {
    case MemberStatus.Cancelled:
      return 0
    case MemberStatus.Expired:
      return 1
    case MemberStatus.Suspended:
      return 2
    default:
      // Active, or anything added to the enum later. Never evicted — the
      // default deliberately excludes rather than includes, so a new status
      // cannot start silently locking members out.
      return Number.MAX_SAFE_INTEGER
  }
}

/**
 * Choose which subjects to evict to free `slotsNeeded` places.
 *
 * @param candidates - Subjects currently on the reader.
 * @param slotsNeeded - How many slots to reclaim.
 * @returns Who to evict, in order, and any shortfall.
 *
 * @example
 * // Needs 2 slots; takes the longest-cancelled first.
 * selectEvictionCandidates(subjects, 2)
 * // => { evict: [cancelledLastYear, cancelledLastMonth], shortfall: 0 }
 */
export function selectEvictionCandidates(
  candidates: EvictableSubject[],
  slotsNeeded: number
): EvictionSelection {
  if (slotsNeeded <= 0) {
    return { evict: [], shortfall: 0 }
  }

  const eligible = candidates
    .filter((c) => statusRank(c.status) !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => {
      const byStatus = statusRank(a.status) - statusRank(b.status)
      if (byStatus !== 0) return byStatus

      // Within a status, the member who has been gone longest goes first.
      return a.nextDueDate.getTime() - b.nextDueDate.getTime()
    })

  const evict = eligible.slice(0, slotsNeeded)

  return {
    evict,
    shortfall: Math.max(0, slotsNeeded - evict.length),
  }
}

/**
 * How many slots to reclaim to bring a reader back under the target.
 *
 * Frees down to the target rather than just under the trigger, so a gym
 * hovering at the limit does not re-run eviction every night for a handful of
 * places.
 *
 * @param used - Templates currently on the reader.
 * @param capacity - What the reader holds, or `null` if unknown.
 * @param evictAbove - Usage fraction that triggers eviction.
 * @param target - Usage fraction to free down to.
 * @returns Slots to reclaim; zero when under the trigger or capacity unknown.
 */
export function slotsToReclaim(
  used: number,
  capacity: number | null,
  evictAbove: number,
  target: number
): number {
  // Unknown capacity is not a reason to start removing people. We learn the
  // real limit from a `-18` (device storage full), and until then guessing
  // could evict members from a reader with plenty of room.
  if (capacity === null || capacity <= 0) return 0

  if (used / capacity <= evictAbove) return 0

  return Math.max(0, Math.ceil(used - capacity * target))
}
