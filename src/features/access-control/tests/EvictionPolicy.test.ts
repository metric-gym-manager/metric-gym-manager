/**
 * Capacity reclamation — policy and execution.
 *
 * The rule that makes the rest of it safe: **a member who can currently enter
 * is never a candidate.** Everything here is a slot occupied by someone the
 * door would refuse anyway, so eviction takes away nothing.
 *
 * The other half of the safety is the vendor keeping the central template, so
 * `revokeBiometrics` (fromdev) is reversible without the member ever going back
 * to the scanner. If that ever stopped being true this policy would become a
 * customer-service problem instead of housekeeping.
 */

import {
  selectEvictionCandidates,
  slotsToReclaim,
  type EvictableSubject,
} from '@/features/access-control/domain/EvictionPolicy'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { MockAccessControlProvider } from '@/lib/access-control'
import type { CommandOutcome } from '@/lib/access-control'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  FakeAccessControlRepository,
  day,
  makeDevice,
  testCredentials,
} from './fakes'

function subject(
  id: string,
  status: MemberStatus,
  dueDate: string
): EvictableSubject {
  return {
    memberId: id,
    subjectId: Number(id.replace(/\D/g, '')) + 100000,
    status,
    nextDueDate: day(dueDate),
  }
}

describe('selectEvictionCandidates', () => {
  it('takes cancelled members before expired ones', () => {
    const selection = selectEvictionCandidates(
      [
        subject('1', MemberStatus.Expired, '2025-11-01'),
        subject('2', MemberStatus.Cancelled, '2026-01-01'),
      ],
      1
    )

    // Cancelled wins even though it lapsed more recently: a cancelled member is
    // the less likely of the two to come back and need their slot.
    expect(selection.evict.map((c) => c.memberId)).toEqual(['2'])
  })

  it('takes the longest-gone first within a status', () => {
    const selection = selectEvictionCandidates(
      [
        subject('1', MemberStatus.Expired, '2025-06-01'),
        subject('2', MemberStatus.Expired, '2024-01-01'),
        subject('3', MemberStatus.Expired, '2025-12-01'),
      ],
      2
    )

    expect(selection.evict.map((c) => c.memberId)).toEqual(['2', '1'])
  })

  it('orders cancelled, then expired, then suspended', () => {
    const selection = selectEvictionCandidates(
      [
        subject('1', MemberStatus.Suspended, '2020-01-01'),
        subject('2', MemberStatus.Expired, '2025-01-01'),
        subject('3', MemberStatus.Cancelled, '2026-01-01'),
      ],
      3
    )

    expect(selection.evict.map((c) => c.memberId)).toEqual(['3', '2', '1'])
  })

  it('never selects an active member', () => {
    const selection = selectEvictionCandidates(
      [
        subject('1', MemberStatus.Active, '2020-01-01'),
        subject('2', MemberStatus.Active, '2019-01-01'),
      ],
      2
    )

    expect(selection.evict).toHaveLength(0)
  })

  it('reports a shortfall rather than over-reaching to meet the target', () => {
    const selection = selectEvictionCandidates(
      [
        subject('1', MemberStatus.Expired, '2025-01-01'),
        subject('2', MemberStatus.Active, '2020-01-01'),
      ],
      5
    )

    // Four slots short. That is a "buy a second reader" conversation, not
    // something to solve by locking out someone who paid.
    expect(selection.evict.map((c) => c.memberId)).toEqual(['1'])
    expect(selection.shortfall).toBe(4)
  })

  it('does nothing when no slots are needed', () => {
    const selection = selectEvictionCandidates(
      [subject('1', MemberStatus.Cancelled, '2020-01-01')],
      0
    )

    expect(selection).toEqual({ evict: [], shortfall: 0 })
  })
})

describe('slotsToReclaim', () => {
  it('stays its hand when capacity is unknown', () => {
    // We learn the real limit from a -18. Guessing could evict members from a
    // reader with plenty of room.
    expect(slotsToReclaim(2900, null, 0.85, 0.7)).toBe(0)
  })

  it('does nothing below the trigger', () => {
    expect(slotsToReclaim(2000, 3000, 0.85, 0.7)).toBe(0)
  })

  it('frees down to the target, not just under the trigger', () => {
    // 2900/3000 is over 85%. Target 70% of 3000 = 2100, so 800 slots — which
    // is what stops a gym hovering at the limit re-running this every night.
    expect(slotsToReclaim(2900, 3000, 0.85, 0.7)).toBe(800)
  })

  it('treats a zero capacity as unknown', () => {
    expect(slotsToReclaim(10, 0, 0.85, 0.7)).toBe(0)
  })
})

describe('EvictInactiveSubjects', () => {
  function build(options: {
    templateCount?: number
    capacity?: number | null
    candidates?: EvictableSubject[]
    credentials?: typeof testCredentials | null
    provider?: MockAccessControlProvider
  }) {
    const repo = new FakeAccessControlRepository({
      credentials:
        options.credentials === undefined
          ? testCredentials
          : options.credentials,
      devices: [
        makeDevice({
          template_count: options.templateCount ?? 0,
          template_capacity: options.capacity ?? null,
        }),
      ],
      evictionCandidates: options.candidates ?? [],
    })

    const provider = options.provider ?? new MockAccessControlProvider()

    return {
      repo,
      provider,
      useCase: new EvictInactiveSubjects(repo, provider),
    }
  }

  it('does nothing for a gym without access control', async () => {
    const { useCase } = build({ credentials: null })

    const summary = await useCase.execute({ gymId: 'gym-1' })

    expect(summary.applicable).toBe(false)
    expect(summary.evicted).toBe(0)
  })

  it('does nothing when the reader is comfortably below the trigger', async () => {
    const { provider, useCase } = build({
      templateCount: 100,
      capacity: 3000,
      candidates: [subject('1', MemberStatus.Cancelled, '2020-01-01')],
    })

    const summary = await useCase.execute({ gymId: 'gym-1' })

    expect(summary.evicted).toBe(0)
    expect(provider.getCommandsOfType('revokeBiometrics')).toHaveLength(0)
  })

  it('revokes the template from the reader but keeps the central copy', async () => {
    const { repo, provider, useCase } = build({
      capacity: 3000,
      templateCount: 2900,
      candidates: [
        subject('1', MemberStatus.Cancelled, '2020-01-01'),
        subject('2', MemberStatus.Expired, '2021-01-01'),
      ],
    })

    const summary = await useCase.execute({ gymId: 'gym-1', forceSlots: 2 })

    expect(summary.evicted).toBe(2)
    // revokeBiometrics is `fromdev`, never removeSubject — the vendor keeps the
    // template, so a returning member is restored by a plain re-sync.
    expect(provider.getCommandsOfType('revokeBiometrics')).toHaveLength(2)
    expect(provider.getCommandsOfType('removeSubject')).toHaveLength(0)
    expect(repo.offDevice).toEqual(['1', '2'])
  })

  it('recounts from the database rather than subtracting', async () => {
    const { repo, useCase } = build({
      capacity: 3000,
      templateCount: 2900,
      candidates: [subject('1', MemberStatus.Cancelled, '2020-01-01')],
    })

    await useCase.execute({ gymId: 'gym-1', forceSlots: 1 })

    // A partial run must not leave the stored figure drifting away from what
    // the reader actually holds.
    expect(repo.recounted).toEqual(['device-1'])
  })

  it('does not mark a member off-device when the revoke failed', async () => {
    class RefusingProvider extends MockAccessControlProvider {
      override revokeBiometrics(): Promise<CommandOutcome> {
        return Promise.resolve({
          status: 'failed',
          error: 'No response from device',
          retryable: true,
        })
      }
    }

    const { repo, useCase } = build({
      capacity: 3000,
      templateCount: 2900,
      candidates: [subject('1', MemberStatus.Cancelled, '2020-01-01')],
      provider: new RefusingProvider(),
    })

    const summary = await useCase.execute({ gymId: 'gym-1', forceSlots: 1 })

    expect(summary.evicted).toBe(0)
    expect(repo.offDevice).toHaveLength(0)
    expect(summary.errors).toHaveLength(1)
  })

  it('surfaces the shortfall when it cannot free enough', async () => {
    const { useCase } = build({
      capacity: 3000,
      templateCount: 2900,
      candidates: [subject('1', MemberStatus.Cancelled, '2020-01-01')],
    })

    const summary = await useCase.execute({ gymId: 'gym-1', forceSlots: 5 })

    expect(summary.evicted).toBe(1)
    expect(summary.shortfall).toBe(4)
  })
})
