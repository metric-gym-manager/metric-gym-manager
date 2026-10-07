/**
 * The four gaps that made the feature runnable but not operable.
 *
 * Each of these was code that existed and was never called, or state that was
 * written and never read. That is a specific kind of bug: nothing fails, a
 * screen is simply always wrong, or a mechanism silently never fires.
 *
 *  * **Presence** — `last_seen_at` came only from scans, so a closed gym read
 *    as offline by morning.
 *  * **Capacity** — eviction existed and nothing triggered it, and the
 *    threshold check could not fire until a reader's real limit was known.
 *  * **Enrolment** — `finger_enrolled` was only ever set to `false`.
 *  * **Health** — dead-lettered jobs surfaced nowhere at all.
 */

import { RefreshDeviceStatus } from '@/features/access-control/services/RefreshDeviceStatus'
import { DetectBiometricEnrolment } from '@/features/access-control/services/DetectBiometricEnrolment'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { MockAccessControlProvider } from '@/lib/access-control'
import type {
  AccessDeviceInfo,
  AccessSubjectInfo,
  CommandOutcome,
} from '@/lib/access-control'
import { serializeAccessDeviceForAPI } from '@/features/access-control/utils/serializeAccessForAPI'
import { DEVICE_OFFLINE_AFTER_SECONDS } from '@/features/access-control/config/AccessControlConfig'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  FakeAccessControlRepository,
  day,
  makeContext,
  makeDevice,
  makeJob,
  makeSubject,
  testCredentials,
} from './fakes'

const TODAY = day('2026-01-10')

function vendorDevice(
  overrides: Partial<AccessDeviceInfo> = {}
): AccessDeviceInfo {
  return {
    serial: 'SER-001',
    name: 'Front Door',
    areaId: 1,
    timezoneOffsetMinutes: 330,
    lastSeenAt: null,
    online: null,
    ...overrides,
  }
}

describe('Gap 1 — device presence', () => {
  function build(
    vendorDevices: AccessDeviceInfo[],
    ourDevices = [makeDevice()]
  ) {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: ourDevices,
      gymsWithAccessControl: ['gym-1'],
    })

    const provider = new MockAccessControlProvider()
    provider.setDevices(vendorDevices)

    return { repo, provider, useCase: new RefreshDeviceStatus(repo, provider) }
  }

  it('takes an explicit online flag as contact now', async () => {
    const { repo, useCase } = build([vendorDevice({ online: true })])

    const summary = await useCase.execute()

    expect(summary.devicesSeen).toBe(1)
    expect(repo.seenDevices[0]?.deviceSerial).toBe('SER-001')
  })

  it('uses the vendor last-activity time when there is no online flag', async () => {
    const seenAt = new Date('2026-01-10T09:00:00Z')
    const { repo, useCase } = build([vendorDevice({ lastSeenAt: seenAt })])

    await useCase.execute()

    expect(repo.seenDevices[0]?.seenAt).toEqual(seenAt)
  })

  it('records nothing when the vendor offers no presence signal at all', async () => {
    // Neither field is documented. Inventing a verdict from silence would put
    // a confident Online on a card with no evidence behind it.
    const { repo, useCase } = build([vendorDevice()])

    const summary = await useCase.execute()

    expect(summary.devicesSeen).toBe(0)
    expect(repo.seenDevices).toHaveLength(0)
  })

  it('separates a reader the vendor does not know from one that is offline', async () => {
    const { useCase } = build([vendorDevice({ serial: 'SOMETHING-ELSE' })])

    const summary = await useCase.execute()

    // Wrong account, mistyped serial, or removed on their side. A different
    // problem from an outage, and it deserves a different answer.
    expect(summary.unknownToVendor).toEqual(['SER-001'])
    expect(summary.devicesSeen).toBe(0)
  })

  it('carries on to other gyms when one vendor account is unreachable', async () => {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      gymsWithAccessControl: ['gym-1', 'gym-2'],
    })

    const provider = new MockAccessControlProvider()
    jest.spyOn(provider, 'listDevices').mockImplementation(async () => {
      throw new Error('vendor unreachable')
    })

    const summary = await new RefreshDeviceStatus(repo, provider).execute()

    expect(summary.errors).toHaveLength(2)
  })

  describe('the presence verdict shown on the card', () => {
    it('reports a reader we have never heard from as unknown, not offline', () => {
      // Normal for a reader registered two minutes ago. Rendering it as
      // offline is a false alarm on the screen meant to prevent false alarms.
      const serialized = serializeAccessDeviceForAPI(
        makeDevice({ last_seen_at: null })
      )

      expect(serialized.presence).toBe('unknown')
    })

    it('reports a recently seen reader as online', () => {
      const serialized = serializeAccessDeviceForAPI(
        makeDevice({ last_seen_at: new Date().toISOString() })
      )

      expect(serialized.presence).toBe('online')
    })

    it('reports a long-silent reader as offline', () => {
      const longAgo = new Date(
        Date.now() - (DEVICE_OFFLINE_AFTER_SECONDS + 60) * 1000
      )

      const serialized = serializeAccessDeviceForAPI(
        makeDevice({ last_seen_at: longAgo.toISOString() })
      )

      expect(serialized.presence).toBe('offline')
    })
  })
})

describe('Gap 2 — eviction triggers', () => {
  /** A provider whose enrolment push reports the reader full. */
  class FullReaderProvider extends MockAccessControlProvider {
    override syncSubjectsToDevice(): Promise<CommandOutcome> {
      return Promise.resolve({
        status: 'failed',
        error: 'Device storage is full',
        retryable: true,
        needsAttention: true,
        returnCode: -18,
      })
    }
  }

  function buildDrain(options: {
    candidates?: Array<{ memberId: string; subjectId: number }>
    capacity?: number | null
    templateCount?: number
  }) {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [
        makeDevice({
          template_capacity: options.capacity ?? null,
          template_count: options.templateCount ?? 2900,
        }),
      ],
      contexts: [
        makeContext({ subject: makeSubject({ synced_device_serials: [] }) }),
      ],
      claimable: [makeJob()],
      evictionCandidates: (options.candidates ?? []).map((c) => ({
        memberId: c.memberId,
        subjectId: c.subjectId,
        status: MemberStatus.Cancelled,
        nextDueDate: day('2024-01-01'),
      })),
    })

    const provider = new FullReaderProvider()

    const drain = new DrainAccessSyncQueue(
      repo,
      new SyncMemberAccess(repo, provider),
      new OperateDevice(repo, provider),
      new EvictInactiveSubjects(repo, provider),
      provider
    )

    return { repo, drain }
  }

  it('learns the reader capacity from the refusal itself', async () => {
    const { repo, drain } = buildDrain({
      candidates: [{ memberId: 'old-1', subjectId: 100002 }],
      capacity: null,
      templateCount: 2900,
    })

    await drain.execute({ today: TODAY })

    // "Full" means the current count IS the limit. Until this is recorded the
    // proactive threshold check cannot fire at all, because slotsToReclaim
    // declines to guess at an unknown capacity.
    expect(repo.learnedCapacities).toEqual([
      { deviceSerial: 'SER-001', capacity: 2900 },
    ])
  })

  it('frees slots and reschedules rather than dead-lettering', async () => {
    const { repo, drain } = buildDrain({
      candidates: [{ memberId: 'old-1', subjectId: 100002 }],
    })

    const summary = await drain.execute({ today: TODAY })

    expect(summary.evicted).toBeGreaterThan(0)
    expect(summary.retrying).toBe(1)
    expect(summary.deadLettered).toBe(0)
    // Rescheduled, so the member who triggered it gets on at the next pass
    // instead of waiting for somebody to notice a dead job.
    expect(repo.settled[0]).toMatchObject({ retryable: true })
  })

  it('dead-letters when nothing can be freed', async () => {
    // Every remaining member on the reader can currently enter. That is a
    // second-reader conversation, and a person has to be told.
    const { drain } = buildDrain({ candidates: [] })

    const summary = await drain.execute({ today: TODAY })

    expect(summary.evicted).toBe(0)
    expect(summary.deadLettered).toBe(1)
    expect(summary.needingAttention).toBe(1)
  })

  describe('the manual button', () => {
    function buildEviction(capacity: number | null) {
      const repo = new FakeAccessControlRepository({
        credentials: testCredentials,
        devices: [
          makeDevice({ template_capacity: capacity, template_count: 100 }),
        ],
        evictionCandidates: [
          {
            memberId: 'old-1',
            subjectId: 100002,
            status: MemberStatus.Cancelled,
            nextDueDate: day('2024-01-01'),
          },
        ],
      })

      const provider = new MockAccessControlProvider()
      return { repo, useCase: new EvictInactiveSubjects(repo, provider) }
    }

    it('frees a batch when a person asks and capacity is unknown', async () => {
      // Capacity is NULL on every reader until one reports itself full, so a
      // button that respected the thresholds would do nothing at all — on
      // every gym, until the first -18.
      const { useCase } = buildEviction(null)

      const summary = await useCase.execute({
        gymId: 'gym-1',
        reason: 'manual',
      })

      expect(summary.evicted).toBe(1)
    })

    it('still does nothing on a proactive sweep with unknown capacity', async () => {
      const { useCase } = buildEviction(null)

      const summary = await useCase.execute({ gymId: 'gym-1' })

      expect(summary.evicted).toBe(0)
    })

    it('does nothing when the reader is known to be comfortably empty', async () => {
      const { useCase } = buildEviction(3000)

      const summary = await useCase.execute({
        gymId: 'gym-1',
        reason: 'manual',
      })

      expect(summary.evicted).toBe(0)
    })

    /**
     * Found pressing the button on a brand-new reader (2026-10-07): "Freed 0,
     * but this reader is still 25 short … you may need a second reader". With
     * capacity unknown the manual batch is a request size, not a measured
     * need, so whatever of it goes unfilled says nothing about the reader —
     * and a shortfall is what tells a gym to buy hardware.
     */
    it('reports no shortfall when capacity is unknown, however little it could free', async () => {
      const { useCase } = buildEviction(null)

      const summary = await useCase.execute({
        gymId: 'gym-1',
        reason: 'manual',
      })

      expect(summary.evicted).toBe(1)
      expect(summary.shortfall).toBe(0)
    })

    it('still reports a real shortfall when a known capacity cannot be met', async () => {
      // 100 held of 110 is past the 85% threshold; reaching the 70% target
      // needs 23 slots and only one member can be removed.
      const { useCase } = buildEviction(110)

      const summary = await useCase.execute({
        gymId: 'gym-1',
        reason: 'manual',
      })

      expect(summary.evicted).toBe(1)
      expect(summary.shortfall).toBeGreaterThan(0)
    })
  })
})

describe('Gap 3 — enrolment detection', () => {
  class SubjectListProvider extends MockAccessControlProvider {
    constructor(private readonly vendorSubjects: AccessSubjectInfo[]) {
      super()
    }

    override listSubjects(): Promise<AccessSubjectInfo[]> {
      return Promise.resolve(this.vendorSubjects)
    }
  }

  function build(subjects: AccessSubjectInfo[], fingerEnrolled = false) {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      contexts: [
        makeContext({
          subject: makeSubject({
            subject_id: 100001,
            finger_enrolled: fingerEnrolled,
          }),
        }),
      ],
    })

    const provider = new SubjectListProvider(subjects)

    return {
      repo,
      enrolled: repo.enrolments,
      useCase: new DetectBiometricEnrolment(repo, provider),
    }
  }

  function vendorSubject(
    subjectId: string,
    templateCount: number
  ): AccessSubjectInfo {
    return { subjectId, name: 'Test', areaId: 1, templateCount }
  }

  it('reports not-yet while the member has no template', async () => {
    const { enrolled, useCase } = build([vendorSubject('100001', 0)])

    const result = await useCase.execute('gym-1', 'member-1')

    // Not an error state: the member simply has not presented a finger yet.
    expect(result.enrolled).toBe(false)
    expect(enrolled).toHaveLength(0)
  })

  it('detects the template and records it', async () => {
    const { enrolled, useCase } = build([vendorSubject('100001', 1)])

    const result = await useCase.execute('gym-1', 'member-1')

    expect(result.enrolled).toBe(true)
    expect(enrolled).toEqual([
      { memberId: 'member-1', enrolled: true, fingerId: 6 },
    ])
  })

  it('does not write on every poll once the answer stops changing', async () => {
    const { enrolled, useCase } = build([vendorSubject('100001', 1)], true)

    await useCase.execute('gym-1', 'member-1')

    // Polled every few seconds while a dialog is open; an unconditional write
    // would be a row update per poll per member being enrolled.
    expect(enrolled).toHaveLength(0)
  })

  it('never reads another tenant’s subject as our member', async () => {
    // The vendor list is account-wide. On a shared account it contains other
    // companies' people, and matching loosely would report a stranger's
    // fingerprint as our member's.
    const { useCase } = build([
      vendorSubject('999999', 1),
      vendorSubject('100002', 1),
    ])

    const result = await useCase.execute('gym-1', 'member-1')

    expect(result.enrolled).toBe(false)
  })

  it('reports an already-known fingerprint the vendor cannot count', async () => {
    const { enrolled, useCase } = build([vendorSubject('100001', 0)], true)

    const result = await useCase.execute('gym-1', 'member-1')

    // A zero count is not evidence of absence. This vendor sends no template
    // count at all (audit Y3, measured on the live account), so zero is what
    // every subject reads as — and the member may equally have been evicted
    // for capacity while the central copy survives. The stored flag is the
    // stronger evidence and is what the caller is told.
    //
    // Additive still: nothing here writes, and nothing here may ever clear the
    // flag. The explicit clear path stays the sole way it goes false.
    expect(result.enrolled).toBe(true)
    expect(enrolled).toHaveLength(0)
  })

  it('reports a scan-confirmed fingerprint even though the vendor lists none', async () => {
    // The live shape, exactly: VFT reports no template field, so the vendor
    // side is permanently silent and `finger_enrolled` was set by the member's
    // first fingerprint scan arriving on the webhook. The enrolment dialog has
    // to be able to succeed on that, or it waits for a flag nothing can set.
    const { useCase } = build(
      [{ ...vendorSubject('100001', 0), templateCount: null }],
      true
    )

    const result = await useCase.execute('gym-1', 'member-1')

    expect(result.enrolled).toBe(true)
  })

  it('does nothing for a member of another gym', async () => {
    const { useCase } = build([vendorSubject('100001', 1)])

    const result = await useCase.execute('another-gym', 'member-1')

    expect(result.applicable).toBe(false)
  })
})
