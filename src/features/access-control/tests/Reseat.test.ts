/**
 * Delete-then-add re-seat (visit 1, D1).
 *
 * After a reader restart a forced re-push did not restore the lost
 * fingerprints; cancelling and reactivating the member did (PH-15). A reader
 * that kept the user but dropped the template ignores a plain re-push for a
 * user it already lists, so `reseat` deletes the subject from every reader
 * first. Cancellation, suspension and the blocked-subject invariant must not
 * move.
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
    syncedDeviceSerials: ['A', 'B'],
    lastSyncedValidFrom: null,
    lastSyncedValidTo: null,
    lastSyncedBlocked: false,
    ...overrides,
  }
}

const decisionFor = (status: MemberStatus) =>
  resolveAccessDecision({
    status,
    membershipStartDate: day('2025-12-15'),
    nextDueDate: day('2026-01-15'),
    registrationSource: RegistrationSource.Manual,
    verifiedAt: null,
    today: day('2026-01-10'),
  })

const pairs = (commands: ReturnType<typeof deriveAccessCommands>) =>
  commands.map((c) => [c.intent, c.deviceSerial])

describe('deriveAccessCommands — reseat (visit 1, D1)', () => {
  it('revokes once, then pushes, grants and windows every reader', () => {
    const commands = deriveAccessCommands({
      decision: decisionFor(MemberStatus.Active),
      subject: subject(),
      deviceSerials: ['A', 'B'],
      reseat: true,
    })

    expect(pairs(commands)).toEqual([
      [AccessIntent.RevokeBiometric, 'A'],
      [AccessIntent.SyncToDevice, 'A'],
      [AccessIntent.SyncToDevice, 'B'],
      [AccessIntent.Grant, 'A'],
      [AccessIntent.Grant, 'B'],
      [AccessIntent.SetValidPeriod, 'A'],
      [AccessIntent.SetValidPeriod, 'B'],
    ])
  })

  it('does not revoke a member the vendor has never heard of', () => {
    const commands = deriveAccessCommands({
      decision: decisionFor(MemberStatus.Active),
      subject: subject({
        provisioned: false,
        syncedDeviceSerials: [],
        lastSyncedBlocked: null,
      }),
      deviceSerials: ['A', 'B'],
      reseat: true,
    })

    expect(
      commands.some((c) => c.intent === AccessIntent.RevokeBiometric)
    ).toBe(false)
    expect(commands[0].intent).toBe(AccessIntent.Provision)
  })

  it('sends a suspended member no revoke and no window', () => {
    const commands = deriveAccessCommands({
      decision: decisionFor(MemberStatus.Suspended),
      subject: subject(),
      deviceSerials: ['A', 'B'],
      reseat: true,
    })

    expect(
      commands.some((c) => c.intent === AccessIntent.RevokeBiometric)
    ).toBe(false)
    expect(containsValidPeriod(commands)).toBe(false)
  })

  it('leaves cancellation exactly as it was', () => {
    const input = {
      decision: decisionFor(MemberStatus.Cancelled),
      subject: subject(),
      deviceSerials: ['A', 'B'],
    }

    expect(deriveAccessCommands({ ...input, reseat: true })).toEqual(
      deriveAccessCommands({ ...input, reseat: false })
    )
  })

  it('does not revoke on a plain forced push', () => {
    const commands = deriveAccessCommands({
      decision: decisionFor(MemberStatus.Active),
      subject: subject(),
      deviceSerials: ['A', 'B'],
      reseat: false,
      force: true,
    })

    expect(
      commands.some((c) => c.intent === AccessIntent.RevokeBiometric)
    ).toBe(false)
  })
})
