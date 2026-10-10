/**
 * Withdrawing a fingerprint erases it at the vendor (visit 1, D2; remote day,
 * F-05).
 *
 * `fromdev` removes a template from the readers but the vendor keeps its
 * central copy, and the next re-send or registration sync put the withdrawn
 * finger back — with no consent on file (PH-19). Clearing now deletes the
 * vendor's record and gives the member a NEW subject id, so no template keyed
 * to the old id can ever be re-attached; an entitled member is re-provisioned,
 * without a fingerprint, by a queued reconcile.
 *
 * Cancellation is untouched: it still blocks and revokes, keeping the central
 * copy so a returning member is restored without re-enrolling.
 */

import { ManageMemberBiometric } from '@/features/access-control/services/ManageMemberBiometric'
import { SyncMemberAccess } from '@/features/access-control/services/SyncMemberAccess'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import { MockAccessControlProvider } from '@/lib/access-control'
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
/** Far from the fake's allocator so a rotated id can never equal this one. */
const OLD_ID = 100500

function setup(subjectOverrides: Parameters<typeof makeSubject>[0] = {}) {
  const context = makeContext({
    subject: makeSubject({
      subject_id: OLD_ID,
      finger_enrolled: true,
      finger_id: 6,
      enrolled_at: '2026-01-01T00:00:00Z',
      provisioned_at: '2026-01-01T00:00:00Z',
      synced_device_serials: ['SER-001'],
      last_synced_valid_from: '20251215',
      last_synced_valid_to: '20270115',
      last_synced_blocked: false,
      ...subjectOverrides,
    }),
  })

  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
    deviceSerials: ['SER-001', 'SER-002'],
    contexts: [context],
  })
  const provider = new MockAccessControlProvider()

  return {
    repo,
    provider,
    context,
    service: new ManageMemberBiometric(repo, provider),
  }
}

describe('Withdrawing a fingerprint erases it at the vendor (visit 1, D2)', () => {
  it('deletes the vendor record, rotates the subject id, clears consent and queues a reconcile', async () => {
    const { service, repo, provider, context } = setup()

    const result = await service.clear(GYM, MEMBER)

    expect(result).toEqual({ applicable: true, dispatched: true })

    // Erased, not merely taken off the readers.
    expect(provider.getCommandsOfType('removeSubject')).toEqual([
      expect.objectContaining({ subjectId: String(OLD_ID) }),
    ])
    expect(provider.getCommandsOfType('revokeBiometrics')).toHaveLength(0)

    const subject = context.subject!
    expect(subject.subject_id).not.toBe(OLD_ID)
    expect(subject.provisioned_at).toBeNull()
    expect(subject.synced_device_serials).toEqual([])
    expect(subject.finger_enrolled).toBe(false)
    expect(subject.finger_id).toBeNull()
    expect(subject.last_synced_blocked).toBeNull()

    expect(repo.consentClears).toEqual([MEMBER])
    expect(context.biometricConsentAt).toBeNull()

    expect(repo.enqueued).toEqual([
      {
        gymId: GYM,
        memberId: MEMBER,
        intent: AccessIntent.ReconcileMember,
        payload: { reason: 'biometric_withdrawn' },
      },
    ])
  })

  it('re-provisions an active member under the new id and never mentions the old one', async () => {
    const { service, repo, provider } = setup()
    await service.clear(GYM, MEMBER)
    const newId = String(await currentId(repo))

    provider.reset()
    await new SyncMemberAccess(repo, provider).execute({
      memberId: MEMBER,
      today: day('2026-10-07'),
    })

    const commands = provider.getCommands()
    expect(commands.map((c) => c.operation)).toEqual(
      expect.arrayContaining([
        'upsertSubject',
        'syncSubjectsToDevice',
        'grantAccess',
        'setValidPeriod',
      ])
    )
    expect(
      provider
        .getCommandsOfType('syncSubjectsToDevice')
        .map((c) => c.deviceSerial)
    ).toEqual(['SER-001', 'SER-002'])
    // Commands about no subject at all (a sign-in) have nothing to leak.
    for (const command of commands.filter((c) => c.subjectId !== undefined)) {
      expect(command.subjectId).toBe(newId)
      expect(command.subjectId).not.toBe(String(OLD_ID))
    }
  })

  it('carries on when the vendor says the employee was already gone', async () => {
    const { service, provider, context } = setup()
    jest.spyOn(provider, 'removeSubject').mockResolvedValueOnce({
      status: 'failed',
      error: `Cannot delete Employee with id=${OLD_ID}. The Employee was not found!`,
      retryable: false,
    })

    const result = await service.clear(GYM, MEMBER)

    expect(result.dispatched).toBe(true)
    expect(context.subject!.subject_id).not.toBe(OLD_ID)
    expect(context.biometricConsentAt).toBeNull()
  })

  it('changes nothing when the vendor refuses for any other reason', async () => {
    const { service, repo, provider, context } = setup()
    jest.spyOn(provider, 'removeSubject').mockResolvedValueOnce({
      status: 'failed',
      error: 'Vendor returned status 502',
      retryable: true,
    })

    const result = await service.clear(GYM, MEMBER)

    expect(result).toEqual({
      applicable: true,
      dispatched: false,
      error: 'The reader did not accept the request',
    })
    // The record may still exist at the vendor, so the consent that permits it
    // stands and nothing is rotated.
    expect(repo.consentClears).toHaveLength(0)
    expect(context.biometricConsentAt).not.toBeNull()
    expect(context.subject!.subject_id).toBe(OLD_ID)
    expect(repo.enqueued).toHaveLength(0)
  })

  it('makes no vendor call for a member who was never provisioned, but still rotates and queues', async () => {
    const { service, repo, provider, context } = setup({
      provisioned_at: null,
      synced_device_serials: [],
      finger_enrolled: false,
    })

    const result = await service.clear(GYM, MEMBER)

    expect(result.dispatched).toBe(true)
    expect(provider.getCommands()).toHaveLength(0)
    expect(context.subject!.subject_id).not.toBe(OLD_ID)
    expect(repo.consentClears).toEqual([MEMBER])
    expect(repo.enqueued).toHaveLength(1)
  })

  it('refuses a member with no subject, as before', async () => {
    const { service, context } = setup()
    context.subject = null

    const result = await service.clear(GYM, MEMBER)

    expect(result).toEqual({
      applicable: true,
      dispatched: false,
      error: 'Member not found',
    })
  })
})

async function currentId(repo: FakeAccessControlRepository): Promise<number> {
  const context = await repo.getMemberAccessContext(MEMBER)
  return context!.subject!.subject_id
}
