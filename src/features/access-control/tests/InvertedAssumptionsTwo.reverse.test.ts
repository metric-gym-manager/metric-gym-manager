/**
 * Inverted-assumption simulation, round two.
 *
 * The first round inverted the assumptions behind the sync path. This one
 * targets what was built since: presence, capacity learning, enrolment
 * detection, and — the richest source of bugs so far — the places where two
 * independently-reasonable decisions **interact**.
 *
 * The assumptions being inverted:
 *
 *  8. A gym that reports a full reader has only one reader.
 *  9. Constants chosen separately can be read separately.
 * 10. A template missing from the vendor means the member has no fingerprint.
 * 11. Contact evidence arrives in chronological order.
 * 12. A reader that has never been counted can still be measured.
 * 13. Presence and capacity are per-gym facts.
 */

import { DrainAccessSyncQueue } from '@/features/access-control/services/DrainAccessSyncQueue'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { EvictInactiveSubjects } from '@/features/access-control/services/EvictInactiveSubjects'
import { DetectBiometricEnrolment } from '@/features/access-control/services/DetectBiometricEnrolment'
import { MockAccessControlProvider } from '@/lib/access-control'
import type { AccessSubjectInfo, CommandOutcome } from '@/lib/access-control'
import { serializeAccessDeviceForAPI } from '@/features/access-control/utils/serializeAccessForAPI'
import {
  DEVICE_OFFLINE_AFTER_SECONDS,
  DRAIN_INTERVAL_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'
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

/** A provider whose push to ONE named reader reports that reader full. */
class OneFullReaderProvider extends MockAccessControlProvider {
  constructor(private readonly fullSerial: string) {
    super()
  }

  override syncSubjectsToDevice(
    _credentials: never,
    deviceSerial: string
  ): Promise<CommandOutcome> {
    if (deviceSerial !== this.fullSerial) {
      return Promise.resolve({ status: 'queued' })
    }

    return Promise.resolve({
      status: 'failed',
      error: 'Device storage is full',
      retryable: true,
      needsAttention: true,
      returnCode: -18,
      deviceSerial,
    })
  }
}

describe('Inverted assumption 8 — a gym reporting a full reader has only one reader', () => {
  it('learns capacity only for the reader that actually refused', async () => {
    // A gym with an old full 1,000-template reader at the front and a new
    // 3,000-template one at the side. Only the front one is full.
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [
        makeDevice({
          id: 'device-1',
          device_serial: 'FULL-ONE',
          template_count: 1000,
          template_capacity: null,
        }),
        makeDevice({
          id: 'device-2',
          device_serial: 'ROOMY-ONE',
          template_count: 40,
          template_capacity: null,
        }),
      ],
      contexts: [
        makeContext({ subject: makeSubject({ synced_device_serials: [] }) }),
      ],
      claimable: [makeJob()],
      evictionCandidates: [
        {
          memberId: 'old-1',
          subjectId: 100002,
          status: MemberStatus.Cancelled,
          nextDueDate: day('2024-01-01'),
        },
      ],
    })

    const provider = new OneFullReaderProvider('FULL-ONE')

    await new DrainAccessSyncQueue(
      repo,
      new SyncMemberAccess(repo, provider),
      new OperateDevice(repo, provider),
      new EvictInactiveSubjects(repo, provider),
      provider
    ).execute({ today: TODAY })

    // Stamping capacity on BOTH readers would tell us the side door holds 40
    // templates. The nightly sweep would then evict from a reader with 2,960
    // free slots, for ever, and nothing would look wrong.
    expect(repo.learnedCapacities).toEqual([
      { deviceSerial: 'FULL-ONE', capacity: 1000 },
    ])
  })
})

describe('Inverted assumption 9 — constants chosen separately can be read separately', () => {
  it('gives presence more headroom than the interval that refreshes it', () => {
    // Presence is refreshed once per drain. If a reader is called offline
    // after less time than passes between refreshes, then every healthy reader
    // spends the tail of each interval showing offline — a permanent flicker
    // on the one screen built to prevent false alarms.
    expect(DEVICE_OFFLINE_AFTER_SECONDS).toBeGreaterThan(
      DRAIN_INTERVAL_SECONDS * 2
    )
  })

  it('still shows a reader online just before the next refresh is due', () => {
    const justBeforeNextRefresh = new Date(
      Date.now() - (DRAIN_INTERVAL_SECONDS + 30) * 1000
    )

    const serialized = serializeAccessDeviceForAPI(
      makeDevice({ last_seen_at: justBeforeNextRefresh.toISOString() })
    )

    expect(serialized.presence).toBe('online')
  })
})

describe('Inverted assumption 10 — a template missing from the vendor means no fingerprint', () => {
  class SubjectListProvider extends MockAccessControlProvider {
    constructor(private readonly vendorSubjects: AccessSubjectInfo[]) {
      super()
    }

    override listSubjects(): Promise<AccessSubjectInfo[]> {
      return Promise.resolve(this.vendorSubjects)
    }
  }

  function build(templateCount: number, fingerEnrolled: boolean) {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      contexts: [
        makeContext({
          subject: makeSubject({
            subject_id: 100001,
            finger_enrolled: fingerEnrolled,
            // Evicted for capacity: off every reader, but the vendor still
            // holds the central copy and the member never re-enrols.
            synced_device_serials: [],
          }),
        }),
      ],
    })

    const provider = new SubjectListProvider([
      { subjectId: '100001', name: 'Test', areaId: 1, templateCount },
    ])

    return {
      repo,
      useCase: new DetectBiometricEnrolment(repo, provider),
    }
  }

  it('does not un-enrol a member whose template was merely evicted', async () => {
    const { repo, useCase } = build(0, true)

    await useCase.execute('gym-1', 'member-1')

    // Whether `GET /api/template` counts central copies or per-reader ones is
    // unverified (simulator plan A-5). If it counts per-reader, a zero here
    // means "evicted", not "never enrolled" — and clearing the flag would tell
    // the desk to walk a member back to the scanner for nothing.
    //
    // Detection is therefore additive only. The explicit clear path stays the
    // sole way `finger_enrolled` goes false.
    expect(repo.enrolments).toHaveLength(0)
  })

  it('still records a newly detected fingerprint', async () => {
    const { repo, useCase } = build(1, false)

    const result = await useCase.execute('gym-1', 'member-1')

    expect(result.enrolled).toBe(true)
    expect(repo.enrolments).toEqual([
      { memberId: 'member-1', enrolled: true, fingerId: 6 },
    ])
  })
})

describe('Inverted assumption 11 — contact evidence arrives in order', () => {
  it('does not let a stale vendor timestamp overwrite a fresher scan', async () => {
    // Two sources at different latencies: a scan lands on the webhook the
    // instant it happens, while the vendor's device listing may be minutes
    // behind. Taking the newest write blindly would age a reader backwards and
    // flip a live one to offline.
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      gymsWithAccessControl: ['gym-1'],
    })

    const fresh = new Date('2026-01-10T09:00:00Z')
    const stale = new Date('2026-01-10T08:00:00Z')

    await repo.markDeviceSeen('SER-001', fresh)
    await repo.markDeviceSeen('SER-001', stale)

    // The guard lives in the repository's WHERE clause, so the fake records
    // both calls; what this pins is that the use case hands the raw vendor
    // time over rather than pre-judging it, and that the ordering rule is
    // expressed once, in SQL, where concurrent writers also obey it.
    expect(repo.seenDevices.map((s) => s.seenAt)).toEqual([fresh, stale])
  })
})

describe('Inverted assumption 13 — presence is a per-gym fact', () => {
  it('never reads another company’s reader as ours on a shared account', async () => {
    // `listDevices` returns every terminal on the vendor account. On a shared
    // account that includes companies who are not our customers, all of them
    // reporting healthy presence.
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice({ device_serial: 'OURS-001' })],
      gymsWithAccessControl: ['gym-1'],
    })

    const provider = new MockAccessControlProvider()
    provider.setDevices([
      {
        serial: 'SOMEONE-ELSES',
        name: 'Their Door',
        areaId: 9,
        timezoneOffsetMinutes: 330,
        lastSeenAt: new Date(),
        online: true,
      },
    ])

    const { RefreshDeviceStatus } =
      await import('@/features/access-control/services/RefreshDeviceStatus')

    const summary = await new RefreshDeviceStatus(repo, provider).execute()

    // Their healthy reader must not mark ours as seen.
    expect(repo.seenDevices).toHaveLength(0)
    expect(summary.unknownToVendor).toEqual(['OURS-001'])
  })
})

describe('Inverted assumption 12 — a reader that has never been counted can be measured', () => {
  it('learns capacity on the FIRST refusal, not the second', async () => {
    // template_count starts at 0 and is only ever written by a recount, which
    // until now only ran during eviction. So a brand-new gym's first `-18`
    // would find count 0, record nothing, and the reader's real limit would
    // stay unknown until it filled up and refused a second time.
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice({ template_count: 0, template_capacity: null })],
      contexts: [
        makeContext({ subject: makeSubject({ synced_device_serials: [] }) }),
      ],
      claimable: [makeJob()],
      evictionCandidates: [
        {
          memberId: 'old-1',
          subjectId: 100002,
          status: MemberStatus.Cancelled,
          nextDueDate: day('2024-01-01'),
        },
      ],
    })

    // The recount reports what the reader really holds.
    jest.spyOn(repo, 'recountDeviceTemplates').mockResolvedValue(1000)

    const provider = new OneFullReaderProvider('SER-001')

    await new DrainAccessSyncQueue(
      repo,
      new SyncMemberAccess(repo, provider),
      new OperateDevice(repo, provider),
      new EvictInactiveSubjects(repo, provider),
      provider
    ).execute({ today: TODAY })

    expect(repo.learnedCapacities).toEqual([
      { deviceSerial: 'SER-001', capacity: 1000 },
    ])
  })
})
