/**
 * Recording consent for a fingerprint that already exists (visit 2, CD-3/V2-6).
 *
 * A finger registered at the reader's own menu has no consent on file, and the
 * only way to attach one used to be removing the fingerprint and starting
 * again. Recording is a dedicated operation: it writes the timestamp and talks
 * to no reader, and it never restamps a member who already consented.
 */

import { ManageMemberBiometric } from '@/features/access-control/services/ManageMemberBiometric'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  makeContext,
  testCredentials,
} from './fakes'

const GYM = 'gym-1'
const MEMBER = 'member-1'

function setup(options: { credentials?: boolean; gymId?: string } = {}) {
  const context = makeContext({
    gymId: options.gymId ?? GYM,
    biometricConsentAt: null,
  })

  const repo = new FakeAccessControlRepository({
    credentials: options.credentials === false ? null : testCredentials,
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

describe('ManageMemberBiometric.recordConsent', () => {
  it('writes the consent once and reports it done, without touching a reader', async () => {
    const { service, repo, provider, context } = setup()

    const result = await service.recordConsent(GYM, MEMBER)

    expect(result).toEqual({ applicable: true, dispatched: true })
    expect(repo.consentWrites).toHaveLength(1)
    expect(repo.consentWrites[0].memberId).toBe(MEMBER)
    expect(context.biometricConsentAt).toBeInstanceOf(Date)
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('does not change the timestamp when called again', async () => {
    const { service, context } = setup()

    await service.recordConsent(GYM, MEMBER)
    const first = context.biometricConsentAt?.getTime()
    await new Promise((resolve) => setTimeout(resolve, 5))
    await service.recordConsent(GYM, MEMBER)

    expect(first).toBeDefined()
    expect(context.biometricConsentAt?.getTime()).toBe(first)
  })

  it("refuses another gym's member and writes nothing", async () => {
    const { service, repo } = setup({ gymId: 'gym-2' })

    const result = await service.recordConsent(GYM, MEMBER)

    expect(result).toEqual({
      applicable: true,
      dispatched: false,
      error: 'Member not found',
    })
    expect(repo.consentWrites).toHaveLength(0)
  })

  it('is not applicable for a gym with no access control', async () => {
    const { service, repo } = setup({ credentials: false })

    const result = await service.recordConsent(GYM, MEMBER)

    expect(result).toEqual({ applicable: false, dispatched: false })
    expect(repo.consentWrites).toHaveLength(0)
  })
})
