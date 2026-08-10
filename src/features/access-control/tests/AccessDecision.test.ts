/**
 * Access decision matrix.
 *
 * This is the only place access policy exists, so it is tested exhaustively.
 *
 * Several of these assertions encode *assumptions* about the hardware that have
 * not yet been confirmed against a live terminal — chiefly that the validity
 * window's end date is inclusive. They are written so that if hardware ever
 * contradicts one, a named test fails and points straight at the fix rather
 * than the behaviour drifting silently.
 */

import {
  resolveAccessDecision,
  describeAccessDenial,
} from '@/features/access-control/domain/AccessDecision'
import { AccessDenialReason } from '@/features/access-control/config/AccessControlConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'

/** A member paid through 15 Jan 2026, registered at the desk. */
function member(
  overrides: Partial<Parameters<typeof resolveAccessDecision>[0]> = {}
) {
  return {
    status: MemberStatus.Active,
    membershipStartDate: new Date('2025-12-15T00:00:00Z'),
    nextDueDate: new Date('2026-01-15T00:00:00Z'),
    registrationSource: RegistrationSource.Manual,
    verifiedAt: null,
    today: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  }
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('resolveAccessDecision', () => {
  describe('happy path', () => {
    it('admits an active member inside their paid window', () => {
      const decision = resolveAccessDecision(member())

      expect(decision.allowed).toBe(true)
      expect(decision.reason).toBeNull()
      expect(decision.removeFromDevice).toBe(false)
    })

    it('returns the window to push to the terminal', () => {
      const decision = resolveAccessDecision(member())

      expect(decision.validFrom).toEqual(day('2025-12-15'))
      expect(decision.validTo).toEqual(day('2026-01-15'))
    })
  })

  /**
   * The rule the whole integration exists to enforce: a member is admitted for
   * the whole of their due date and refused from midnight that night.
   *
   * If the terminal turns out to treat EndDate as EXCLUSIVE, the first two
   * assertions here fail and the fix is a single `+1 day` when building the
   * window — with these tests proving it.
   */
  describe('the midnight boundary', () => {
    it('admits the member ON their due date', () => {
      const decision = resolveAccessDecision(
        member({ today: day('2026-01-15') })
      )

      expect(decision.allowed).toBe(true)
    })

    it('refuses the member the day AFTER their due date', () => {
      const decision = resolveAccessDecision(
        member({ today: day('2026-01-16') })
      )

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe(AccessDenialReason.Expired)
    })

    /**
     * The pre-cron window, and the reason this function takes dates rather than
     * reading `members.status`.
     *
     * The terminal refuses from local midnight, but `update-expired-status`
     * does not run until 00:00 UTC (05:30 in Sri Lanka). In between, the status
     * column still says Active. Deciding from the date keeps the app's answer
     * identical to the door's, so staff are never told a member is fine while
     * the gate is turning them away.
     */
    it('refuses an expired member whose status column still reads Active', () => {
      const decision = resolveAccessDecision(
        member({ status: MemberStatus.Active, today: day('2026-01-16') })
      )

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe(AccessDenialReason.Expired)
    })

    it('does not carry a validity window into a denial', () => {
      const decision = resolveAccessDecision(
        member({ today: day('2026-01-16') })
      )

      // Pushing a window alongside a block would give the terminal
      // contradictory instructions.
      expect(decision.validFrom).toBeNull()
      expect(decision.validTo).toBeNull()
    })
  })

  describe('status-driven denials', () => {
    it('refuses a suspended member even while their payment is current', () => {
      const decision = resolveAccessDecision(
        member({ status: MemberStatus.Suspended, today: day('2026-01-10') })
      )

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe(AccessDenialReason.Suspended)
    })

    it('refuses a cancelled member and takes them off the hardware', () => {
      const decision = resolveAccessDecision(
        member({ status: MemberStatus.Cancelled })
      )

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe(AccessDenialReason.Cancelled)
      expect(decision.removeFromDevice).toBe(true)
    })

    it('only removes from the hardware for cancellation, not suspension', () => {
      // A suspension is expected to be lifted, so the enrolled fingerprint
      // should survive it — otherwise every reinstatement needs a re-enrolment.
      const decision = resolveAccessDecision(
        member({ status: MemberStatus.Suspended })
      )

      expect(decision.removeFromDevice).toBe(false)
    })

    it('refuses an expired member whose date has not yet passed', () => {
      // Inconsistent state: status and dates disagree. The stricter of the two
      // must win, so nothing inconsistent can open a door.
      const decision = resolveAccessDecision(
        member({ status: MemberStatus.Expired, today: day('2026-01-10') })
      )

      expect(decision.allowed).toBe(false)
    })
  })

  describe('unverified self-registrations', () => {
    it('refuses a QR registration the desk has not verified', () => {
      const decision = resolveAccessDecision(
        member({
          registrationSource: RegistrationSource.Qr,
          verifiedAt: null,
        })
      )

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe(AccessDenialReason.Unverified)
    })

    it('admits a QR registration once verified', () => {
      const decision = resolveAccessDecision(
        member({
          registrationSource: RegistrationSource.Qr,
          verifiedAt: new Date('2025-12-16T09:00:00Z'),
        })
      )

      expect(decision.allowed).toBe(true)
    })

    it('does not require verification for desk registrations', () => {
      // Manual registrations are verified by definition — a staff member filled
      // the form in person.
      const decision = resolveAccessDecision(
        member({
          registrationSource: RegistrationSource.Manual,
          verifiedAt: null,
        })
      )

      expect(decision.allowed).toBe(true)
    })

    it('prioritises the unverified reason over expiry', () => {
      // Both apply; the actionable one for staff is the verification.
      const decision = resolveAccessDecision(
        member({
          registrationSource: RegistrationSource.Qr,
          verifiedAt: null,
          today: day('2026-02-20'),
        })
      )

      expect(decision.reason).toBe(AccessDenialReason.Unverified)
    })
  })

  describe('membership start date', () => {
    it('refuses access before the membership begins', () => {
      const decision = resolveAccessDecision(
        member({
          membershipStartDate: day('2026-02-01'),
          nextDueDate: day('2026-03-01'),
          today: day('2026-01-20'),
        })
      )

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe(AccessDenialReason.NotStarted)
    })

    it('admits on the first day of the membership', () => {
      const decision = resolveAccessDecision(
        member({
          membershipStartDate: day('2026-02-01'),
          nextDueDate: day('2026-03-01'),
          today: day('2026-02-01'),
        })
      )

      expect(decision.allowed).toBe(true)
    })
  })

  describe('timezone independence', () => {
    it('ignores the time component of the inputs', () => {
      // Dates arrive from Postgres DATE columns and from JS Dates with varying
      // times. The verdict is a calendar-day comparison and must not shift
      // because one input happened to carry 23:00.
      const decision = resolveAccessDecision(
        member({
          nextDueDate: new Date('2026-01-15T23:59:59Z'),
          today: new Date('2026-01-15T00:00:00Z'),
        })
      )

      expect(decision.allowed).toBe(true)
      expect(decision.validTo).toEqual(day('2026-01-15'))
    })

    it('is unaffected by the order of same-day comparisons', () => {
      const decision = resolveAccessDecision(
        member({
          nextDueDate: new Date('2026-01-15T00:00:00Z'),
          today: new Date('2026-01-15T18:30:00Z'),
        })
      )

      expect(decision.allowed).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('admits a member whose window is a single day', () => {
      const decision = resolveAccessDecision(
        member({
          membershipStartDate: day('2026-01-15'),
          nextDueDate: day('2026-01-15'),
          today: day('2026-01-15'),
        })
      )

      // A day pass: starts and ends today, and must work today.
      expect(decision.allowed).toBe(true)
      expect(decision.validFrom).toEqual(decision.validTo)
    })

    it('refuses a day pass the following day', () => {
      const decision = resolveAccessDecision(
        member({
          membershipStartDate: day('2026-01-15'),
          nextDueDate: day('2026-01-15'),
          today: day('2026-01-16'),
        })
      )

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toBe(AccessDenialReason.Expired)
    })

    it('refuses when the due date precedes the start date', () => {
      // Corrupt data should never be resolved in the member's favour.
      const decision = resolveAccessDecision(
        member({
          membershipStartDate: day('2026-03-01'),
          nextDueDate: day('2026-01-01'),
          today: day('2026-02-01'),
        })
      )

      expect(decision.allowed).toBe(false)
    })
  })
})

describe('describeAccessDenial', () => {
  it('explains every denial reason in plain language', () => {
    for (const reason of Object.values(AccessDenialReason)) {
      const text = describeAccessDenial(reason)

      expect(text.length).toBeGreaterThan(0)
      // Gym managers must never see vendor or infrastructure detail (rule 2.9).
      expect(text).not.toMatch(/error|code|api|device|http|null|undefined/i)
    }
  })

  it('describes an allowed decision', () => {
    expect(describeAccessDenial(null)).toMatch(/allowed/i)
  })
})
