/**
 * Registering a reader checks its serial against the VFT account (remote day,
 * F-07).
 *
 * A serial is how a webhook scan finds its gym, so a typo registers a reader
 * that no scan will ever match, with a dashboard that shows it fine. Two guards:
 * the serial is upper-cased on the way in (vendors print and send capitals, and
 * a lower-case copy was a second reader that matched nothing), and it must be on
 * the gym's own VFT account — but only when that list is readable and non-empty.
 * The check is a typo guard, not a gate: an unreachable vendor must not stop a
 * gym adding its reader.
 */

import { RegisterDevice } from '@/features/access-control/services/RegisterDevice'
import { registerDeviceSchema } from '@/features/access-control/schemas/access-control.schemas'
import { MockAccessControlProvider } from '@/lib/access-control'
import type { AccessDeviceInfo } from '@/lib/access-control'
import { FakeAccessControlRepository, testCredentials } from './fakes'

const GYM = 'gym-1'

function onAccount(serial: string): AccessDeviceInfo {
  return {
    serial,
    name: 'Front Door',
    areaId: 1,
    timezoneOffsetMinutes: 330,
    lastSeenAt: null,
    online: null,
  }
}

function setup(options: { credentials?: boolean; listed?: string[] } = {}) {
  const repo = new FakeAccessControlRepository({
    credentials: options.credentials === false ? null : testCredentials,
  })
  const provider = new MockAccessControlProvider()
  provider.setDevices((options.listed ?? []).map(onAccount))
  return { repo, provider, useCase: new RegisterDevice(repo, provider) }
}

/** Exactly what the route hands the use case: the schema's output. */
const input = (deviceSerial: string) =>
  registerDeviceSchema.parse({ deviceSerial, deviceName: 'Front Door' })

describe('registerDeviceSchema — the serial is upper-cased (F-07)', () => {
  it('trims and upper-cases what the desk typed', () => {
    expect(input('  nyu7251900077 ').deviceSerial).toBe('NYU7251900077')
  })

  it('still rejects characters that could escape a URL path', () => {
    expect(
      registerDeviceSchema.safeParse({
        deviceSerial: '../../etc',
        deviceName: 'Door',
      }).success
    ).toBe(false)
  })
})

describe('RegisterDevice (F-07)', () => {
  it('registers a lower-case, padded serial that is on the account, stored in capitals', async () => {
    const { repo, useCase } = setup({ listed: ['NYU7251900077'] })

    const result = await useCase.execute(GYM, input(' nyu7251900077 '))

    expect(result.notOnAccount).toBeUndefined()
    expect(result.device?.device_serial).toBe('NYU7251900077')
    expect(repo.registeredDevices).toHaveLength(1)
  })

  it('matches the account list whatever case the vendor prints it in', async () => {
    const { useCase } = setup({ listed: ['nyu7251900077'] })

    const result = await useCase.execute(GYM, input('NYU7251900077'))

    expect(result.device).toBeDefined()
  })

  it('refuses a serial that is not on the account, registering nothing', async () => {
    const { repo, useCase } = setup({ listed: ['NYU7254500734'] })

    const result = await useCase.execute(GYM, input('NYU7251900077'))

    expect(result).toEqual({ notOnAccount: true })
    expect(repo.registeredDevices).toHaveLength(0)
  })

  it('registers when the account lists no readers at all', async () => {
    // An empty list is indistinguishable from "we could not see the list".
    const { repo, useCase } = setup({ listed: [] })

    const result = await useCase.execute(GYM, input('NYU7251900077'))

    expect(result.device).toBeDefined()
    expect(repo.registeredDevices).toHaveLength(1)
  })

  it('registers when the vendor cannot be asked', async () => {
    const { repo, provider, useCase } = setup({ listed: ['NYU7254500734'] })
    jest
      .spyOn(provider, 'listDevices')
      .mockRejectedValueOnce(new Error('network down'))

    const result = await useCase.execute(GYM, input('NYU7251900077'))

    expect(result.device).toBeDefined()
    expect(repo.registeredDevices).toHaveLength(1)
  })

  it('registers when the gym has no credentials to check with', async () => {
    const { repo, provider, useCase } = setup({
      credentials: false,
      listed: ['NYU7254500734'],
    })

    const result = await useCase.execute(GYM, input('NYU7251900077'))

    expect(result.device).toBeDefined()
    expect(provider.getCommandsOfType('listDevices')).toHaveLength(0)
    expect(repo.registeredDevices).toHaveLength(1)
  })
})
