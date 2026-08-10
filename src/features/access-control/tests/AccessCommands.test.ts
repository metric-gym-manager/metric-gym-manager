/**
 * Command derivation.
 *
 * The most important test in this feature is the first one: a blocked subject
 * must never be sent a validity period. On some ZKTeco firmware a later
 * property write resets the privilege flags an earlier block set, so a naive
 * nightly refresh would un-suspend every suspended member. Nothing in the app
 * would notice — the door would just start opening.
 */

import {
  deriveAccessCommands,
  containsValidPeriod,
  type SubjectSyncState,
} from '@/features/access-control/domain/AccessCommands'
import { resolveAccessDecision } from '@/features/access-control/domain/AccessDecision'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import { RegistrationSource } from '@/features/members/config/RegistrationConfig'

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

function subject(overrides: Partial<SubjectSyncState> = {}): SubjectSyncState {
  return {
    subjectId: '100001',
    memberName: 'Test Member',
    provisioned: true,
    lastSyncedValidFrom: null,
    lastSyncedValidTo: null,
    lastSyncedBlocked: false,
    ...overrides,
  }
}

function decisionFor(
  status: MemberStatus,
  today = day('2026-01-10'),
  dueDate = day('2026-01-15')
) {
  return resolveAccessDecision({
    status,
    membershipStartDate: day('2025-12-15'),
    nextDueDate: dueDate,
    registrationSource: RegistrationSource.Manual,
    verifiedAt: null,
    today,
  })
}

describe('deriveAccessCommands', () => {
  describe('the blocked-subject invariant', () => {
    it.each([
      ['suspended', MemberStatus.Suspended, day('2026-01-10')],
      ['expired', MemberStatus.Active, day('2026-02-20')],
    ])(
      'never sends a validity period for a %s member',
      (_label, status, today) => {
        const commands = deriveAccessCommands({
          decision: decisionFor(status, today),
          subject: subject(),
          deviceSerials: ['DEV-1'],
        })

        expect(containsValidPeriod(commands)).toBe(false)
      }
    )

    it('sends a block instead', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Suspended),
        subject: subject(),
        deviceSerials: ['DEV-1'],
      })

      expect(commands.map((c) => c.intent)).toContain(AccessIntent.Block)
    })

    it('does not re-block a subject already believed blocked', () => {
      // Re-sending is not merely wasteful: every extra write is another chance
      // for firmware to mangle the record.
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Suspended),
        subject: subject({ lastSyncedBlocked: true }),
        deviceSerials: ['DEV-1'],
      })

      expect(commands).toHaveLength(0)
    })
  })

  describe('provisioning order', () => {
    it('creates the subject and pushes it to the device before the window', () => {
      // The terminal requires the user profile in its memory before a validity
      // period will bind to it. Wrong order fails silently, leaving a member
      // with a fingerprint and no window.
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({ provisioned: false }),
        deviceSerials: ['DEV-1'],
      })

      const order = commands.map((c) => c.intent)

      expect(order.indexOf(AccessIntent.Provision)).toBeLessThan(
        order.indexOf(AccessIntent.SyncToDevice)
      )
      expect(order.indexOf(AccessIntent.SyncToDevice)).toBeLessThan(
        order.indexOf(AccessIntent.SetValidPeriod)
      )
    })

    it('does not re-provision an already-provisioned subject', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({ provisioned: true }),
        deviceSerials: ['DEV-1'],
      })

      expect(commands.map((c) => c.intent)).not.toContain(
        AccessIntent.Provision
      )
    })
  })

  describe('validity window', () => {
    it('formats dates as YYYYMMDD for the terminal', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject(),
        deviceSerials: ['DEV-1'],
      })

      const window = commands.find(
        (c) => c.intent === AccessIntent.SetValidPeriod
      )

      expect(window?.startDate).toBe('20251215')
      expect(window?.endDate).toBe('20260115')
    })

    it('pushes nothing when the window already matches', () => {
      // There is no bulk validity endpoint, so re-asserting unchanged members
      // is one HTTP call each for no effect.
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({
          lastSyncedValidFrom: '20251215',
          lastSyncedValidTo: '20260115',
        }),
        deviceSerials: ['DEV-1'],
      })

      expect(commands).toHaveLength(0)
    })

    it('pushes when the window has moved', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({
          lastSyncedValidFrom: '20251215',
          lastSyncedValidTo: '20251215',
        }),
        deviceSerials: ['DEV-1'],
      })

      expect(containsValidPeriod(commands)).toBe(true)
    })
  })

  describe('reinstatement', () => {
    it('lifts the block before setting the window', () => {
      // The reverse order could leave a member blocked but holding a valid
      // window — locked out with nothing in our records explaining why.
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({ lastSyncedBlocked: true }),
        deviceSerials: ['DEV-1'],
      })

      const order = commands.map((c) => c.intent)

      expect(order.indexOf(AccessIntent.Grant)).toBeGreaterThanOrEqual(0)
      expect(order.indexOf(AccessIntent.Grant)).toBeLessThan(
        order.indexOf(AccessIntent.SetValidPeriod)
      )
    })

    it('re-pushes the window even if it matches, when unblocking', () => {
      // The block may have disturbed the stored window, so it is re-asserted
      // rather than assumed intact.
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({
          lastSyncedBlocked: true,
          lastSyncedValidFrom: '20251215',
          lastSyncedValidTo: '20260115',
        }),
        deviceSerials: ['DEV-1'],
      })

      expect(containsValidPeriod(commands)).toBe(true)
    })
  })

  describe('cancellation', () => {
    it('removes the subject from the hardware', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Cancelled),
        subject: subject(),
        deviceSerials: ['DEV-1'],
      })

      expect(commands).toHaveLength(1)
      expect(commands[0].intent).toBe(AccessIntent.RemoveSubject)
    })
  })

  describe('edge cases', () => {
    it('returns nothing when the gym has no devices', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({ provisioned: false }),
        deviceSerials: [],
      })

      expect(commands).toHaveLength(0)
    })

    it('addresses every device the gym has', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject(),
        deviceSerials: ['DEV-1', 'DEV-2'],
      })

      const serials = commands
        .filter((c) => c.intent === AccessIntent.SetValidPeriod)
        .map((c) => c.deviceSerial)

      expect(serials).toEqual(['DEV-1', 'DEV-2'])
    })
  })
})
