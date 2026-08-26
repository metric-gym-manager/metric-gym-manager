/**
 * Remote unlock and restart.
 *
 * Small surface, physically consequential: opening a door remotely admits
 * whoever is standing there. The two things worth proving are that the device
 * is resolved from *our* records (the vendor token reaches every device on the
 * account, so this lookup is the only tenant boundary) and that the request is
 * recorded before it is dispatched.
 */

import { OperateDevice } from '@/features/access-control/services/OperateDevice'
import { MockAccessControlProvider } from '@/lib/access-control'
import type { CommandOutcome } from '@/lib/access-control'
import { AccessIntent } from '@/features/access-control/config/AccessControlConfig'
import {
  FakeAccessControlRepository,
  makeDevice,
  testCredentials,
} from './fakes'

function build(
  provider: MockAccessControlProvider = new MockAccessControlProvider(),
  credentials: typeof testCredentials | null = testCredentials
) {
  const repo = new FakeAccessControlRepository({
    credentials,
    devices: [makeDevice()],
  })

  return { repo, provider, useCase: new OperateDevice(repo, provider) }
}

const request = { gymId: 'gym-1', deviceId: 'device-1', actorId: 'user-7' }

describe('OperateDevice', () => {
  it('unlocks a door and records who asked', async () => {
    const { repo, provider, useCase } = build()

    const result = await useCase.openDoor(request)

    expect(result).toEqual({ applicable: true, dispatched: true })
    expect(provider.getCommandsOfType('openDoor')).toEqual([
      { operation: 'openDoor', deviceSerial: 'SER-001' },
    ])
    expect(repo.enqueued[0]).toMatchObject({
      gymId: 'gym-1',
      memberId: null,
      intent: AccessIntent.OpenDoor,
      payload: {
        actorId: 'user-7',
        deviceId: 'device-1',
        deviceSerial: 'SER-001',
        dispatchedInline: true,
      },
    })
  })

  it('restarts a reader', async () => {
    const { provider, useCase } = build()

    const result = await useCase.reboot(request)

    expect(result.dispatched).toBe(true)
    expect(provider.getCommandsOfType('rebootDevice')).toHaveLength(1)
  })

  it('refuses a device that is not this gym’s', async () => {
    const { provider, useCase } = build()

    const result = await useCase.openDoor({
      ...request,
      deviceId: 'another-gyms-device',
    })

    expect(result).toMatchObject({ applicable: false, dispatched: false })
    // Nothing reached the hardware. The vendor token would have opened that
    // door quite happily, so this check is the whole boundary.
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('does nothing for a gym without access control', async () => {
    const { provider, useCase } = build(new MockAccessControlProvider(), null)

    const result = await useCase.openDoor(request)

    expect(result).toEqual({ applicable: false, dispatched: false })
    expect(provider.getCommands()).toHaveLength(0)
  })

  it('still records the attempt when the hardware refuses', async () => {
    class RefusingProvider extends MockAccessControlProvider {
      override openDoor(): Promise<CommandOutcome> {
        return Promise.resolve({
          status: 'failed',
          error: 'No response from device',
          retryable: true,
        })
      }
    }

    const { repo, useCase } = build(new RefusingProvider())

    const result = await useCase.openDoor(request)

    expect(result).toMatchObject({ dispatched: false })
    // Recorded before dispatch: an operation that reaches the hardware but
    // fails on the way back is still attributable to whoever asked.
    expect(repo.enqueued).toHaveLength(1)
  })
})
