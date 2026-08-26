/**
 * Consent to fingerprint collection.
 *
 * A fingerprint template is sensitive personal data, and pressing "Register
 * fingerprint" is what causes one to be taken. So the invariant these tests
 * exist to hold is narrow and absolute:
 *
 *   **No enrolment command reaches a reader unless a consent record exists.**
 *
 * Everything else here follows from that. The gate lives in the service rather
 * than the route, so no future caller can route around it. The consent is
 * written *before* the command, so a crash between the two leaves a record
 * with no template — harmless — rather than a template with no record. And
 * removing a fingerprint clears the record, because that is what withdrawal
 * means: the next enrolment has to ask again.
 */

import { ManageMemberBiometric } from '@/features/access-control/services/ManageMemberBiometric'
import { GetMemberAccessStatus } from '@/features/access-control/services/GetMemberAccessStatus'
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
const DEVICE = 'device-1'

function setup(consentedAt: Date | null) {
  const context = makeContext({ biometricConsentAt: consentedAt })

  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    devices: [makeDevice()],
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

describe('Biometric consent', () => {
  describe('enrolment gate', () => {
    it('refuses to start enrolment when no consent is on file', async () => {
      const { service, provider } = setup(null)

      const result = await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
      })

      expect(result.dispatched).toBe(false)
      expect(result.consentRequired).toBe(true)
      // The point of the whole exercise: the reader was never asked to collect
      // anything.
      expect(provider.getCommands()).toHaveLength(0)
    })

    it('starts enrolment when consent is granted in the request', async () => {
      const { service, provider, repo } = setup(null)

      const result = await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
        consentGranted: true,
      })

      expect(result.dispatched).toBe(true)
      expect(result.consentRequired).toBeUndefined()
      expect(repo.consentWrites).toHaveLength(1)
      expect(repo.consentWrites[0].memberId).toBe(MEMBER)
      expect(provider.getCommands().length).toBeGreaterThan(0)
    })

    it('starts enrolment without asking again when consent is already on file', async () => {
      const { service, repo } = setup(new Date('2026-02-01T09:00:00Z'))

      const result = await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
      })

      expect(result.dispatched).toBe(true)
      // Being enrolled again is not a fresh act of consent, so nothing is
      // written and the original timestamp stands.
      expect(repo.consentWrites).toHaveLength(0)
    })

    it('keeps the original timestamp when consent is re-sent for a consented member', async () => {
      const original = new Date('2026-02-01T09:00:00Z')
      const { service, repo, context } = setup(original)

      await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
        consentGranted: true,
      })

      expect(repo.consentWrites).toHaveLength(0)
      expect(context.biometricConsentAt).toEqual(original)
    })

    it('records the consent before the reader is commanded, never after', async () => {
      const { service, repo, provider } = setup(null)

      const order: string[] = []

      const realWrite = repo.recordBiometricConsent.bind(repo)
      repo.recordBiometricConsent = async (memberId: string, at: Date) => {
        order.push('consent')
        return realWrite(memberId, at)
      }

      const realEnrol = provider.startFingerEnrolment.bind(provider)
      provider.startFingerEnrolment = async (
        ...args: Parameters<typeof provider.startFingerEnrolment>
      ) => {
        order.push('command')
        return realEnrol(...args)
      }

      await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
        consentGranted: true,
      })

      // A record with no template is harmless. A template with no record is
      // the failure this ordering exists to make impossible.
      expect(order[0]).toBe('consent')
      expect(order).toContain('command')
    })

    it('dispatches nothing if the consent write fails', async () => {
      const { service, repo, provider } = setup(null)

      repo.recordBiometricConsent = async () => {
        throw new Error('database unavailable')
      }

      await expect(
        service.enrol({
          gymId: GYM,
          memberId: MEMBER,
          deviceId: DEVICE,
          consentGranted: true,
        })
      ).rejects.toThrow('database unavailable')

      expect(provider.getCommands()).toHaveLength(0)
    })

    it('refuses before touching the vendor even for an unprovisioned member', async () => {
      // Enrolment provisions a missing subject on the way through. That work
      // must sit *behind* the gate — otherwise a refused enrolment still
      // creates the member on the vendor platform.
      const context = makeContext({
        biometricConsentAt: null,
        subject: makeSubject({ provisioned_at: null }),
      })

      const repo = new FakeAccessControlRepository({
        credentials: testCredentials,
        devices: [makeDevice()],
        contexts: [context],
      })

      const provider = new MockAccessControlProvider()
      const service = new ManageMemberBiometric(repo, provider)

      const result = await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
      })

      expect(result.consentRequired).toBe(true)
      expect(provider.getCommands()).toHaveLength(0)
    })

    it('reports "not applicable" before consent for a gym with no access control', async () => {
      const repo = new FakeAccessControlRepository({
        contexts: [makeContext({ biometricConsentAt: null })],
      })

      const service = new ManageMemberBiometric(
        repo,
        new MockAccessControlProvider()
      )

      const result = await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
      })

      // An unconfigured gym is not a consent problem, and telling the desk to
      // collect consent it cannot use would be nonsense.
      expect(result.applicable).toBe(false)
      expect(result.consentRequired).toBeUndefined()
      expect(repo.consentWrites).toHaveLength(0)
    })

    it('does not record consent for a member belonging to another gym', async () => {
      // Gym 2 has its own reader, so the device lookup succeeds and the
      // refusal comes from the member's own gym not matching — the boundary
      // actually under test, rather than the device one firing first.
      const repo = new FakeAccessControlRepository({
        credentials: testCredentials,
        devices: [
          makeDevice(),
          makeDevice({
            id: 'device-2',
            gym_id: 'gym-2',
            device_serial: 'SER-002',
          }),
        ],
        contexts: [makeContext({ biometricConsentAt: null })],
      })

      const provider = new MockAccessControlProvider()

      const result = await new ManageMemberBiometric(repo, provider).enrol({
        gymId: 'gym-2',
        memberId: MEMBER,
        deviceId: 'device-2',
        consentGranted: true,
      })

      expect(result.dispatched).toBe(false)
      expect(result.error).toBe('Member not found')
      // A consent "granted" by the wrong gym is not consent, and must not be
      // written against a member that gym cannot see.
      expect(repo.consentWrites).toHaveLength(0)
      expect(provider.getCommands()).toHaveLength(0)
    })
  })

  describe('withdrawal', () => {
    it('clears consent when the fingerprint is removed', async () => {
      const { service, repo, context } = setup(new Date('2026-02-01T09:00:00Z'))

      const result = await service.clear(GYM, MEMBER)

      expect(result.dispatched).toBe(true)
      expect(repo.consentClears).toEqual([MEMBER])
      expect(context.biometricConsentAt).toBeNull()
    })

    it('makes the next enrolment ask again', async () => {
      const { service, provider } = setup(new Date('2026-02-01T09:00:00Z'))

      await service.clear(GYM, MEMBER)
      const before = provider.getCommands().length

      const result = await service.enrol({
        gymId: GYM,
        memberId: MEMBER,
        deviceId: DEVICE,
      })

      expect(result.consentRequired).toBe(true)
      expect(provider.getCommands()).toHaveLength(before)
    })

    it('leaves consent alone when the vendor refuses the removal', async () => {
      const { service, repo, provider } = setup(
        new Date('2026-02-01T09:00:00Z')
      )

      provider.revokeBiometrics = async () => ({
        status: 'failed' as const,
        error: 'device offline',
        retryable: true,
      })

      const result = await service.clear(GYM, MEMBER)

      expect(result.dispatched).toBe(false)
      // The template may still be on the reader, so the consent that permits
      // it to be there has to stand. Clearing it here would leave a template
      // held under no recorded permission.
      expect(repo.consentClears).toHaveLength(0)
    })
  })

  describe('what the front desk is shown', () => {
    it('surfaces the consent date on the member status', async () => {
      const consentedAt = new Date('2026-02-01T09:00:00Z')

      const repo = new FakeAccessControlRepository({
        credentials: testCredentials,
        contexts: [makeContext({ biometricConsentAt: consentedAt })],
      })

      const status = await new GetMemberAccessStatus(repo).execute(
        GYM,
        MEMBER,
        day('2026-01-10')
      )

      expect(status?.biometricConsentAt).toBe(consentedAt.toISOString())
    })

    it('reports null when no consent is on file, so the panel asks', async () => {
      const repo = new FakeAccessControlRepository({
        credentials: testCredentials,
        contexts: [makeContext({ biometricConsentAt: null })],
      })

      const status = await new GetMemberAccessStatus(repo).execute(
        GYM,
        MEMBER,
        day('2026-01-10')
      )

      expect(status?.biometricConsentAt).toBeNull()
    })
  })
})
