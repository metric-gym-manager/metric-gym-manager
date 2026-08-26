/**
 * @jest-environment node
 */

/**
 * The three vendor calls the collection offers and we were not making.
 *
 * All three share a shape worth naming: **they matter to a human, not to a
 * door.** Access is driven by subject ids and validity windows, so none of
 * these changes whether the door opens. What they change is whether the person
 * reading a screen — at the desk, or on VFT's console mid-incident — sees the
 * truth.
 *
 * That is why every one of them is best-effort and non-fatal. A gym must be
 * able to register and rename members whether or not a door controller is
 * reachable; letting a cosmetic vendor call fail that would invert the entire
 * premise of the integration.
 */

import { PushRename } from '@/features/access-control/services/PushRename'
import { MockAccessControlProvider } from '@/lib/access-control'
import type { CommandOutcome } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  makeContext,
  makeDevice,
  makeSubject,
  testCredentials,
} from './fakes'

describe('PushRename — members', () => {
  function build(options: {
    provisioned?: boolean
    name?: string
    credentials?: typeof testCredentials | null
  }) {
    const repo = new FakeAccessControlRepository({
      credentials:
        options.credentials === undefined
          ? testCredentials
          : options.credentials,
      devices: [makeDevice()],
      contexts: [
        makeContext({
          memberName: options.name ?? 'Amal Perera',
          subject: makeSubject({
            provisioned_at:
              options.provisioned === false ? null : '2026-01-01T00:00:00Z',
          }),
        }),
      ],
    })

    const provider = new MockAccessControlProvider()
    return { repo, provider, useCase: new PushRename(repo, provider) }
  }

  it('sends the new name to the vendor', async () => {
    const { provider, useCase } = build({ name: 'Amal Perera' })

    const result = await useCase.member('gym-1', 'member-1')

    expect(result.pushed).toBe(true)
    expect(provider.getCommandsOfType('renameSubject')).toEqual([
      {
        operation: 'renameSubject',
        subjectId: '100001',
        details: { name: 'Amal Perera' },
      },
    ])
  })

  it('does nothing for a member who was never provisioned', async () => {
    // There is no vendor record to rename, and the name will be correct
    // whenever they are first pushed.
    const { provider, useCase } = build({ provisioned: false })

    const result = await useCase.member('gym-1', 'member-1')

    expect(result.applicable).toBe(false)
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('does nothing for a gym without access control', async () => {
    const { provider, useCase } = build({ credentials: null })

    const result = await useCase.member('gym-1', 'member-1')

    expect(result.applicable).toBe(false)
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('refuses to rename a member belonging to another gym', async () => {
    const { provider, useCase } = build({})

    const result = await useCase.member('another-gym', 'member-1')

    expect(result.applicable).toBe(false)
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('reports a vendor refusal without throwing', async () => {
    class RefusingProvider extends MockAccessControlProvider {
      override renameSubject(): Promise<CommandOutcome> {
        return Promise.resolve({
          status: 'failed',
          error: 'No response from device',
          retryable: true,
        })
      }
    }

    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices: [makeDevice()],
      contexts: [makeContext()],
    })

    const result = await new PushRename(repo, new RefusingProvider()).member(
      'gym-1',
      'member-1'
    )

    // A stale label is a confusion, not an outage. The caller swallows this.
    expect(result).toEqual({ applicable: true, pushed: false })
  })
})

describe('PushRename — devices', () => {
  function build(devices = [makeDevice({ device_name: 'Side Door' })]) {
    const repo = new FakeAccessControlRepository({
      credentials: testCredentials,
      devices,
    })

    const provider = new MockAccessControlProvider()
    return { repo, provider, useCase: new PushRename(repo, provider) }
  }

  it('sends the new reader name to the vendor', async () => {
    const { provider, useCase } = build()

    const result = await useCase.device('gym-1', 'device-1')

    expect(result.pushed).toBe(true)
    expect(provider.getCommandsOfType('renameDevice')).toEqual([
      {
        operation: 'renameDevice',
        deviceSerial: 'SER-001',
        details: { deviceName: 'Side Door' },
      },
    ])
  })

  it('refuses a device that is not this gym’s', async () => {
    const { provider, useCase } = build()

    const result = await useCase.device('another-gym', 'device-1')

    // The vendor token reaches every terminal on the account, so this lookup
    // is the only thing stopping one gym renaming another's reader.
    expect(result.applicable).toBe(false)
    expect(provider.getCommands()).toHaveLength(0)
  })
})

describe('the vendor request shapes', () => {
  /**
   * Captures what the real client would put on the wire.
   *
   * The rename endpoints take a single field each, and the collection shows
   * `AreaID` as a commented-out sibling on the device one. Sending it would
   * turn a cosmetic edit into a silent re-areaing, so these assertions pin the
   * bodies rather than trusting the comment.
   */
  it('renames a subject with the name alone, never the area', async () => {
    const { VftAccessControlProvider } =
      await import('@/lib/access-control/VftAccessControlProvider')

    const calls: Array<{ url: string; init: RequestInit }> = []
    const originalFetch = global.fetch

    global.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init })
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Return: 0 }),
        json: async () => ({ token: 'tok' }),
      } as unknown as Response
    }) as unknown as typeof fetch

    try {
      await new VftAccessControlProvider().renameSubject(
        { ...testCredentials, apiToken: 'tok' },
        '100001',
        'Amal Perera'
      )
    } finally {
      global.fetch = originalFetch
    }

    const call = calls.at(-1)!

    expect(call.url).toContain('/api/template/edit/100001')
    expect(call.init.method).toBe('PUT')

    const body = JSON.parse(String(call.init.body))
    expect(body).toEqual({ EmpName: 'Amal_Perera' })
    // Spaces become underscores because the vendor's field wants them to —
    // applied in the client so no caller has to remember.
    expect(body).not.toHaveProperty('AreaID')
  })

  it('renames a device with the name alone, never the area', async () => {
    const { VftAccessControlProvider } =
      await import('@/lib/access-control/VftAccessControlProvider')

    const calls: Array<{ url: string; init: RequestInit }> = []
    const originalFetch = global.fetch

    global.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init })
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Return: 0 }),
        json: async () => ({ token: 'tok' }),
      } as unknown as Response
    }) as unknown as typeof fetch

    try {
      await new VftAccessControlProvider().renameDevice(
        { ...testCredentials, apiToken: 'tok' },
        'QEM1253800017',
        'Side Door'
      )
    } finally {
      global.fetch = originalFetch
    }

    const call = calls.at(-1)!

    expect(call.url).toContain('/api/device/QEM1253800017')
    expect(call.init.method).toBe('PUT')

    const body = JSON.parse(String(call.init.body))
    expect(body).toEqual({ DevName: 'Side Door' })
    expect(body).not.toHaveProperty('AreaID')
  })
})
