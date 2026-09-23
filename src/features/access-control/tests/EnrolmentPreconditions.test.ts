/**
 * What has to be true before a reader is told to enrol someone.
 *
 * Found on live hardware, 2026-09-23. A cancelled member was created on the
 * vendor and then `enrollfinger` was sent to a reader that had never received
 * that subject — `synced_device_serials` was empty. The reader acknowledged
 * the command (`Return=6`, the same value it gives for a subject it does know)
 * and nothing could possibly come of it.
 *
 * Two preconditions, and the service owns both so no caller can route around
 * them — the same reasoning as the consent gate it sits beside:
 *
 *   1. The member must currently be **allowed**. Enrolling a cancelled member
 *      would mean pushing them onto a reader they are not entitled to be on,
 *      which is the one thing the access model exists to prevent.
 *   2. The subject must already be **on that reader**. Creating it on the
 *      vendor is not the same thing, as the code's own comment says.
 */

import { ManageMemberBiometric } from '@/features/access-control/services/ManageMemberBiometric'
import { MockAccessControlProvider } from '@/lib/access-control'
import { MemberStatus } from '@/features/members/config/StatusConfig'
import {
  FakeAccessControlRepository,
  makeContext,
  makeDevice,
  makeSubject,
  testCredentials,
  day,
} from './fakes'

const GYM = 'gym-1'
const MEMBER = 'member-1'
const DEVICE = 'device-1'
const SERIAL = 'SER-001'

function setup(options: {
  status?: MemberStatus
  nextDueDate?: Date
  syncedTo?: string[]
}) {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice({ id: DEVICE, device_serial: SERIAL })],
    contexts: [
      makeContext({
        memberId: MEMBER,
        status: options.status ?? MemberStatus.Active,
        nextDueDate: options.nextDueDate ?? day('2027-01-01'),
        biometricConsentAt: new Date('2026-01-01'),
        subject: makeSubject({
          provisioned_at: '2026-01-01T00:00:00Z',
          synced_device_serials: options.syncedTo ?? [SERIAL],
        }),
      }),
    ],
  })

  const provider = new MockAccessControlProvider()
  return { repo, provider, service: new ManageMemberBiometric(repo, provider) }
}

describe('enrolment preconditions', () => {
  it('enrols a member who is allowed and already on the reader', async () => {
    const { service, provider } = setup({})

    const result = await service.enrol({
      gymId: GYM,
      memberId: MEMBER,
      deviceId: DEVICE,
    })

    expect(result.dispatched).toBe(true)
    expect(provider.getCommandsOfType('startFingerEnrolment')).toHaveLength(1)
  })

  it('refuses a member whose access is not active', async () => {
    const { service, provider } = setup({ status: MemberStatus.Cancelled })

    const result = await service.enrol({
      gymId: GYM,
      memberId: MEMBER,
      deviceId: DEVICE,
    })

    expect(result.dispatched).toBe(false)
    expect(result.error).toMatch(/active/i)
    // The reader must not be told to enrol somebody it should not admit.
    expect(provider.getCommandsOfType('startFingerEnrolment')).toHaveLength(0)
  })

  it('refuses a member whose membership has lapsed', async () => {
    const { service, provider } = setup({ nextDueDate: day('2020-01-01') })

    const result = await service.enrol({
      gymId: GYM,
      memberId: MEMBER,
      deviceId: DEVICE,
    })

    expect(result.dispatched).toBe(false)
    expect(provider.getCommandsOfType('startFingerEnrolment')).toHaveLength(0)
  })

  it('pushes the subject to the reader first when it is not there yet', async () => {
    const { service, provider } = setup({ syncedTo: [] })

    const result = await service.enrol({
      gymId: GYM,
      memberId: MEMBER,
      deviceId: DEVICE,
    })

    expect(result.dispatched).toBe(true)

    // The order is the point: a reader cannot enrol a subject it has never
    // received, and it acknowledges the attempt anyway.
    const sync = provider.getCommandsOfType('syncSubjectsToDevice')
    expect(sync).toHaveLength(1)
    expect(sync[0]).toMatchObject({
      deviceSerial: SERIAL,
      details: { subjectIds: ['100001'] },
    })
  })

  it('does not re-push a subject the reader already holds', async () => {
    const { service, provider } = setup({ syncedTo: [SERIAL] })

    await service.enrol({ gymId: GYM, memberId: MEMBER, deviceId: DEVICE })

    expect(provider.getCommandsOfType('syncSubjectsToDevice')).toHaveLength(0)
  })
})
