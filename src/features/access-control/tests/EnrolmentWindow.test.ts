/**
 * Grant and window behind an enrolment (visit 1, D3).
 *
 * Four of five enrolments on visit 1 were refused with event 23 "invalid time
 * period" on the member's first scan, until a re-send carried an Access Grant.
 * The reader runs its command queue in order, so a grant and a window queued
 * right after `Enroll User` land once the finger has been taken and restore
 * whatever the enrolment reset (PH-14).
 */

import { ManageMemberBiometric } from '@/features/access-control/services/ManageMemberBiometric'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  makeContext,
  makeDevice,
  testCredentials,
} from './fakes'

const GYM = 'gym-1'
const MEMBER = 'member-1'
const DEVICE = 'device-1'

function setup() {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
    // Active, due 2027-01-15, consent on file, already held by SER-001.
    contexts: [makeContext()],
  })
  const provider = new MockAccessControlProvider()

  return { repo, provider, service: new ManageMemberBiometric(repo, provider) }
}

const enrol = (service: ManageMemberBiometric) =>
  service.enrol({ gymId: GYM, memberId: MEMBER, deviceId: DEVICE })

describe('Enrolment — grant and window behind the Enroll (visit 1, D3)', () => {
  it('queues the grant, then the window, after the enrolment request', async () => {
    const { service, provider } = setup()

    const result = await enrol(service)

    expect(result.dispatched).toBe(true)
    expect(provider.getCommands().map((c) => c.operation)).toEqual([
      'startFingerEnrolment',
      'grantAccess',
      'setValidPeriod',
    ])

    const [, grant, window] = provider.getCommands()
    expect(grant.deviceSerial).toBe('SER-001')
    expect(grant.subjectId).toBe('100001')
    expect(window.deviceSerial).toBe('SER-001')
    expect(window.subjectId).toBe('100001')
    // The fixture member: started 2025-12-15, paid through 2027-01-15.
    expect(window.details).toEqual({
      startDate: '20251215',
      endDate: '20270115',
    })
  })

  it('still reports the enrolment as dispatched and queues a forced retry when the grant fails', async () => {
    const { service, provider, repo } = setup()
    jest.spyOn(provider, 'grantAccess').mockResolvedValueOnce({
      status: 'failed',
      error: 'Vendor returned status 502',
      retryable: true,
    })

    const result = await enrol(service)

    expect(result).toEqual({ applicable: true, dispatched: true })
    expect(repo.enqueued).toEqual([
      {
        gymId: GYM,
        memberId: MEMBER,
        intent: AccessIntent.ReconcileMember,
        payload: { reason: 'post_enrol_window', force: true },
      },
    ])
    // A failed grant means the window is not attempted behind it.
    expect(provider.getCommandsOfType('setValidPeriod')).toHaveLength(0)
  })

  it('queues a forced retry when the window fails after a good grant', async () => {
    const { service, provider, repo } = setup()
    jest.spyOn(provider, 'setValidPeriod').mockResolvedValueOnce({
      status: 'failed',
      error: 'Vendor returned status 502',
      retryable: true,
    })

    const result = await enrol(service)

    expect(result.dispatched).toBe(true)
    expect(repo.enqueued).toHaveLength(1)
    expect(repo.enqueued[0].payload).toEqual({
      reason: 'post_enrol_window',
      force: true,
    })
  })

  it('queues a forced retry when the vendor call throws', async () => {
    const { service, provider, repo } = setup()
    jest
      .spyOn(provider, 'grantAccess')
      .mockRejectedValueOnce(new Error('network down'))

    const result = await enrol(service)

    expect(result.dispatched).toBe(true)
    expect(repo.enqueued).toHaveLength(1)
  })

  it('queues nothing when the grant and the window both land', async () => {
    const { service, repo } = setup()

    await enrol(service)

    expect(repo.enqueued).toHaveLength(0)
  })

  it('sends neither grant nor window when the enrolment request itself fails', async () => {
    const { service, provider, repo } = setup()
    jest.spyOn(provider, 'startFingerEnrolment').mockResolvedValueOnce({
      status: 'failed',
      error: 'Vendor returned status 500',
      retryable: true,
    })

    const result = await enrol(service)

    expect(result.dispatched).toBe(false)
    expect(provider.getCommandsOfType('grantAccess')).toHaveLength(0)
    expect(provider.getCommandsOfType('setValidPeriod')).toHaveLength(0)
    expect(repo.enqueued).toHaveLength(0)
  })
})
