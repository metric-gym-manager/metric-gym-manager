/**
 * The 5-minute device refresh also recounts how many members each reader holds
 * (remote day F-13, visit 1 PH-16).
 *
 * `template_count` was set when a reader was first read and never again, so the
 * card could show 0 beside a reader that held members. The recount is cheap
 * (our own record, no vendor call) and must not depend on the vendor being
 * reachable: a vendor outage is exactly when a stale count misleads most.
 */

import { RefreshDeviceStatus } from '@/features/access-control/services/RefreshDeviceStatus'
import { MockAccessControlProvider } from '@/lib/access-control'
import {
  FakeAccessControlRepository,
  makeDevice,
  testCredentials,
} from './fakes'

function build() {
  const repo = new FakeAccessControlRepository({
    credentials: testCredentials,
    gymsWithAccessControl: ['gym-1'],
    devices: [
      makeDevice({ id: 'device-A', device_serial: 'A' }),
      makeDevice({ id: 'device-B', device_serial: 'B' }),
      makeDevice({ id: 'device-C', device_serial: 'C', is_active: false }),
    ],
  })
  const provider = new MockAccessControlProvider()
  return { repo, provider, useCase: new RefreshDeviceStatus(repo, provider) }
}

describe('RefreshDeviceStatus — recount (F-13)', () => {
  it('recounts every active reader and reports how many', async () => {
    const { repo, useCase } = build()

    const summary = await useCase.execute()

    expect(repo.recounted.sort()).toEqual(['device-A', 'device-B'])
    expect(summary.devicesRecounted).toBe(2)
  })

  it('still recounts when the vendor cannot be asked', async () => {
    const { repo, provider, useCase } = build()
    jest
      .spyOn(provider, 'listDevices')
      .mockRejectedValueOnce(new Error('network down'))

    const summary = await useCase.execute()

    expect(summary.devicesRecounted).toBe(2)
    expect(repo.recounted.sort()).toEqual(['device-A', 'device-B'])
    // The outage is still reported; it just no longer hides the counts.
    expect(summary.errors).toEqual([expect.stringContaining('network down')])
  })

  it('records a failed recount and carries on with the other readers', async () => {
    const { repo, useCase } = build()
    const real = repo.recountDeviceTemplates.bind(repo)
    jest
      .spyOn(repo, 'recountDeviceTemplates')
      .mockImplementationOnce(async () => {
        throw new Error('count failed')
      })
      .mockImplementation(real)

    const summary = await useCase.execute()

    expect(summary.devicesRecounted).toBe(1)
    expect(summary.errors).toEqual([
      expect.stringContaining('Recount A: count failed'),
    ])
  })
})
