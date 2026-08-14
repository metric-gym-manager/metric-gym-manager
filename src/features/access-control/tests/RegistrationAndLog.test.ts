/**
 * Registration provisioning, and the check-in log's read path.
 *
 * These two have nothing in common except the property that matters most about
 * both: **neither may break the thing it decorates.** An unreachable door
 * controller must not fail a registration, and a filtered log must not lie
 * about how many results there are.
 */

import { provisionMemberAccessBestEffort } from '@/features/access-control/services/provisionMemberAccessBestEffort'
import { serializeAccessEventForAPI } from '@/features/access-control/utils/serializeAccessForAPI'
import {
  codesForKind,
  DeviceEventKind,
} from '@/features/access-control/config/DeviceEventCodes'
import type { AccessEvent } from '@/features/access-control/types'

const mockExecute = jest.fn()

jest.mock('@/features/access-control/services/factory', () => ({
  createSyncMemberAccess: jest.fn(() => ({ execute: mockExecute })),
}))

const supabase = {} as never

function makeEvent(overrides: Partial<AccessEvent> = {}): AccessEvent {
  return {
    id: 'event-1',
    gym_id: 'gym-1',
    member_id: 'member-1',
    device_serial: 'SER-001',
    subject_id: 100001,
    occurred_at: '2026-01-10T06:30:00Z',
    verify_type: 1,
    checking_status: 0,
    event_code: '0',
    raw: { vendorInternal: 'do-not-expose' },
    created_at: '2026-01-10T06:30:01Z',
    ...overrides,
  }
}

describe('inline provision at registration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExecute.mockResolvedValue({
      applicable: true,
      allowed: true,
      commandsSent: 3,
      commandsPending: 0,
      failures: [],
    })
  })

  it('pushes the new member to the hardware immediately', async () => {
    // The point of existing: staff register someone and walk them straight to
    // the reader. Waiting five minutes for the drain breaks that workflow.
    const reached = await provisionMemberAccessBestEffort(supabase, 'member-1')

    expect(reached).toBe(true)
    expect(mockExecute).toHaveBeenCalledWith({ memberId: 'member-1' })
  })

  it('never throws when the vendor is unreachable', async () => {
    mockExecute.mockRejectedValue(new Error('vendor unreachable'))

    // A gym must be able to sign a member up whether or not a door controller
    // is reachable. The member is already in the database and the outbox job
    // is already queued.
    await expect(
      provisionMemberAccessBestEffort(supabase, 'member-1')
    ).resolves.toBe(false)
  })

  it('never throws when the sync itself reports failures', async () => {
    mockExecute.mockResolvedValue({
      applicable: true,
      allowed: true,
      commandsSent: 1,
      commandsPending: 0,
      failures: [
        {
          message: 'Device storage is full',
          retryable: false,
          needsAttention: true,
        },
      ],
    })

    await expect(
      provisionMemberAccessBestEffort(supabase, 'member-1')
    ).resolves.toBe(false)
  })

  it('treats a gym without access control as a non-event', async () => {
    mockExecute.mockResolvedValue({
      applicable: false,
      allowed: false,
      commandsSent: 0,
      commandsPending: 0,
      failures: [],
    })

    // The ordinary case for almost every gym. Not a failure, nothing to do.
    await expect(
      provisionMemberAccessBestEffort(supabase, 'member-1')
    ).resolves.toBe(false)
  })
})

describe('the check-in log filter', () => {
  it('enumerates codes for each kind so the filter can run in SQL', () => {
    // Filtering after the fetch would return however many of a 50-row page
    // survived, which makes pagination lie.
    expect(codesForKind(DeviceEventKind.Denied)).toContain(29)
    expect(codesForKind(DeviceEventKind.Granted)).toContain(0)
    expect(codesForKind(DeviceEventKind.Alarm)).toContain(101)
    expect(codesForKind(DeviceEventKind.System)).toContain(200)
  })

  it('returns nothing for Other, which is defined by absence', () => {
    // "Other" is every code we do NOT classify, so it cannot be listed. A
    // filter for it would have to be a NOT IN, and there is no product reason
    // to offer one.
    expect(codesForKind(DeviceEventKind.Other)).toEqual([])
  })

  it('keeps the kind sets disjoint, so a filter cannot double-count', () => {
    const kinds = [
      DeviceEventKind.Granted,
      DeviceEventKind.Denied,
      DeviceEventKind.Alarm,
      DeviceEventKind.System,
    ]

    const seen = new Set<number>()

    for (const kind of kinds) {
      for (const code of codesForKind(kind)) {
        expect(seen.has(code)).toBe(false)
        seen.add(code)
      }
    }
  })
})

describe('the check-in log row', () => {
  it('carries the member name, so the log is readable by a human', () => {
    const serialized = serializeAccessEventForAPI({
      ...makeEvent(),
      memberName: 'Nimal Perera',
    })

    expect(serialized.memberName).toBe('Nimal Perera')
  })

  it('accepts an unattributed scan rather than hiding it', () => {
    // An unrecognised finger has no subject to resolve. Those rows are how a
    // gym notices someone trying their luck.
    const serialized = serializeAccessEventForAPI(
      makeEvent({ member_id: null })
    )

    expect(serialized.memberId).toBeNull()
    expect(serialized.memberName).toBeNull()
  })

  it('still never exposes the raw vendor payload', () => {
    const serialized = serializeAccessEventForAPI({
      ...makeEvent(),
      memberName: 'Nimal Perera',
    })

    expect(JSON.stringify(serialized)).not.toContain('do-not-expose')
  })
})
