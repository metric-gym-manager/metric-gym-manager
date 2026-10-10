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
    syncedDeviceSerials: ['DEV-1', 'DEV-2'],
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
        subject: subject({ provisioned: false, syncedDeviceSerials: [] }),
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
    it('blocks the member and clears their template from the reader', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Cancelled),
        subject: subject(),
        deviceSerials: ['DEV-1'],
      })

      const intents = commands.map((c) => c.intent)

      expect(intents).toContain(AccessIntent.Block)
      expect(intents).toContain(AccessIntent.RevokeBiometric)
    })

    it('never destroys the vendor-side record', () => {
      // Regression: cancellation used to emit RemoveSubject, which deletes the
      // central template too. Cancelled -> Active is a supported transition, so
      // that silently locked a returning, paying member out while our records
      // still said they were fine. Caught by the reverse test.
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Cancelled),
        subject: subject(),
        deviceSerials: ['DEV-1'],
      })

      expect(commands.map((c) => c.intent)).not.toContain(
        AccessIntent.RemoveSubject
      )
    })

    it('blocks before revoking, so a failed second call still shuts the door', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Cancelled),
        subject: subject(),
        deviceSerials: ['DEV-1'],
      })

      const intents = commands.map((c) => c.intent)

      expect(intents.indexOf(AccessIntent.Block)).toBeLessThan(
        intents.indexOf(AccessIntent.RevokeBiometric)
      )
    })

    it('sends nothing for a member who was never on the hardware', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Cancelled),
        subject: subject({ provisioned: false, syncedDeviceSerials: [] }),
        deviceSerials: ['DEV-1'],
      })

      expect(commands).toHaveLength(0)
    })
  })

  describe('forced re-assert — the desk override', () => {
    // "Re-send to readers" exists for the moment our record and the reader
    // disagree: a reader reset by its installer, a template that never reached
    // the second door. Diffing against our own record is exactly what cannot
    // see that, so a forced run ignores what we believe the readers hold.
    const matching = subject({
      lastSyncedValidFrom: '20251215',
      lastSyncedValidTo: '20260115',
    })

    it('pushes the member and their window to every reader even when our record already matches', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: matching,
        deviceSerials: ['DEV-1', 'DEV-2'],
        force: true,
      })

      const sent = (intent: AccessIntent) =>
        commands.filter((c) => c.intent === intent).map((c) => c.deviceSerial)

      expect(sent(AccessIntent.SyncToDevice)).toEqual(['DEV-1', 'DEV-2'])
      expect(sent(AccessIntent.SetValidPeriod)).toEqual(['DEV-1', 'DEV-2'])
    })

    it('lifts any block on every reader before the window, because our record of the block may be what is wrong', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: matching,
        deviceSerials: ['DEV-1', 'DEV-2'],
        force: true,
      })

      const order = commands.map((c) => c.intent)
      const grants = commands
        .filter((c) => c.intent === AccessIntent.Grant)
        .map((c) => c.deviceSerial)

      expect(grants).toEqual(['DEV-1', 'DEV-2'])
      expect(order.lastIndexOf(AccessIntent.Grant)).toBeLessThan(
        order.indexOf(AccessIntent.SetValidPeriod)
      )
    })

    it('re-sends the block to every reader for a member who cannot get in', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Suspended),
        subject: subject({ lastSyncedBlocked: true }),
        deviceSerials: ['DEV-1', 'DEV-2'],
        force: true,
      })

      expect(
        commands
          .filter((c) => c.intent === AccessIntent.Block)
          .map((c) => c.deviceSerial)
      ).toEqual(['DEV-1', 'DEV-2'])
    })

    it.each([
      ['suspended', MemberStatus.Suspended, day('2026-01-10')],
      ['expired', MemberStatus.Active, day('2026-02-20')],
    ])(
      'still never sends a validity period for a %s member',
      (_label, status, today) => {
        const commands = deriveAccessCommands({
          decision: decisionFor(status, today),
          subject: subject({ lastSyncedBlocked: true }),
          deviceSerials: ['DEV-1', 'DEV-2'],
          force: true,
        })

        expect(containsValidPeriod(commands)).toBe(false)
        // Nor a template push: a blocked member's slot is not worth spending.
        expect(commands.map((c) => c.intent)).not.toContain(
          AccessIntent.SyncToDevice
        )
      }
    )

    it('sends nothing for a member who cannot get in and was never on the hardware', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Suspended),
        subject: subject({ provisioned: false, syncedDeviceSerials: [] }),
        deviceSerials: ['DEV-1'],
        force: true,
      })

      expect(commands).toHaveLength(0)
    })

    it('leaves cancellation exactly as it was', () => {
      const input = {
        decision: decisionFor(MemberStatus.Cancelled),
        subject: subject(),
        deviceSerials: ['DEV-1', 'DEV-2'],
      }

      expect(deriveAccessCommands({ ...input, force: true })).toEqual(
        deriveAccessCommands(input)
      )
    })
  })

  describe('grant on hand-over (visit 1, D3)', () => {
    const intents = (commands: ReturnType<typeof deriveAccessCommands>) =>
      commands.map((c) => [c.intent, c.deviceSerial])

    it('grants every reader a never-provisioned member is handed to', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({
          provisioned: false,
          syncedDeviceSerials: [],
          lastSyncedBlocked: null,
        }),
        deviceSerials: ['A', 'B'],
      })

      expect(commands.map((c) => c.intent)).toEqual([
        AccessIntent.Provision,
        AccessIntent.SyncToDevice,
        AccessIntent.SyncToDevice,
        AccessIntent.Grant,
        AccessIntent.Grant,
        AccessIntent.SetValidPeriod,
        AccessIntent.SetValidPeriod,
      ])
      expect(
        commands
          .filter((c) => c.intent === AccessIntent.Grant)
          .map((c) => c.deviceSerial)
      ).toEqual(['A', 'B'])
    })

    it('grants only the reader a held member is newly handed to', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({ syncedDeviceSerials: ['A'] }),
        deviceSerials: ['A', 'B'],
      })

      expect(intents(commands)).toEqual([
        [AccessIntent.SyncToDevice, 'B'],
        [AccessIntent.Grant, 'B'],
        [AccessIntent.SetValidPeriod, 'A'],
        [AccessIntent.SetValidPeriod, 'B'],
      ])
    })

    it('sends no grant when no reader is handed the member', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({
          syncedDeviceSerials: ['A', 'B'],
          lastSyncedValidFrom: '20250101',
          lastSyncedValidTo: '20250201',
        }),
        deviceSerials: ['A', 'B'],
      })

      expect(
        commands.some((c) => c.intent === AccessIntent.SetValidPeriod)
      ).toBe(true)
      expect(commands.some((c) => c.intent === AccessIntent.Grant)).toBe(false)
    })

    it('sends a suspended member neither a grant nor a window', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Suspended),
        subject: subject({ syncedDeviceSerials: [] }),
        deviceSerials: ['A', 'B'],
      })

      expect(commands.some((c) => c.intent === AccessIntent.Grant)).toBe(false)
      expect(containsValidPeriod(commands)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns nothing when the gym has no devices', () => {
      const commands = deriveAccessCommands({
        decision: decisionFor(MemberStatus.Active),
        subject: subject({ provisioned: false, syncedDeviceSerials: [] }),
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
