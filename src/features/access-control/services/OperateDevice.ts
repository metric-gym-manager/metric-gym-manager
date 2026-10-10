/**
 * Remote device operations — unlock and restart.
 *
 * Small, but physically consequential: opening a door remotely admits whoever
 * happens to be standing there. So it gets a real audit trail, from two
 * independent directions:
 *
 *   1. Our own `access_sync_jobs` row, carrying the actor who asked.
 *   2. The reader's own event **8 — "open the door remotely"** arriving back
 *      through the webhook, which is confirmation from the hardware itself
 *      rather than from the system that requested it.
 *
 * Neither alone is enough. Ours proves intent, theirs proves effect.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import type { IAccessControlRepository } from './IAccessControlRepository'
import {
  AccessIntent,
  REBOOT_RESEAT_DELAY_SECONDS,
} from '@/features/access-control/config/AccessControlConfig'

export interface OperateDeviceInput {
  gymId: string
  deviceId: string
  /** Who asked. Recorded on the job for the audit trail. */
  actorId: string
}

export interface OperateDeviceResult {
  /** False when the gym has no access control configured. */
  applicable: boolean
  /** True once the vendor accepted the command. */
  dispatched: boolean
  error?: string
  /**
   * Members queued for a re-seat after a restart (visit 1, D1). Present only
   * for a restart the vendor accepted; 0 when the repair could not be queued.
   */
  membersQueuedForRepair?: number
}

export class OperateDevice {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Unlock a door.
   *
   * @param input - Gym, device and the acting user.
   */
  async openDoor(input: OperateDeviceInput): Promise<OperateDeviceResult> {
    return this.operate(input, AccessIntent.OpenDoor)
  }

  /**
   * Restart a reader.
   *
   * @param input - Gym, device and the acting user.
   */
  async reboot(input: OperateDeviceInput): Promise<OperateDeviceResult> {
    return this.operate(input, AccessIntent.RebootDevice)
  }

  private async operate(
    input: OperateDeviceInput,
    intent: AccessIntent
  ): Promise<OperateDeviceResult> {
    const credentials = await this.repo.getCredentials(input.gymId)
    if (!credentials) {
      return { applicable: false, dispatched: false }
    }

    const devices = await this.repo.listDevices(input.gymId)
    // Resolved from our own records, never from the request: the vendor token
    // reaches every device on the account, so this lookup is what keeps one
    // gym from operating another gym's door.
    const device = devices.find((d) => d.id === input.deviceId)

    if (!device) {
      return {
        applicable: false,
        dispatched: false,
        error: 'Device not found for this gym',
      }
    }

    // Record the request before dispatching, so an operation that reaches the
    // hardware but fails on the way back is still attributable.
    await this.repo.enqueue(input.gymId, null, intent, {
      actorId: input.actorId,
      deviceId: device.id,
      deviceSerial: device.device_serial,
      requestedAt: new Date().toISOString(),
      dispatchedInline: true,
    })

    const outcome =
      intent === AccessIntent.OpenDoor
        ? await this.provider.openDoor(credentials, device.device_serial)
        : await this.provider.rebootDevice(credentials, device.device_serial)

    if (outcome.status === 'failed') {
      return { applicable: true, dispatched: false, error: outcome.error }
    }

    if (intent !== AccessIntent.RebootDevice) {
      return { applicable: true, dispatched: true }
    }

    // Visit 1, D1 (PH-15): a restart kept the users and dropped their
    // fingerprints, and only a delete-then-add brought them back. Queued for
    // after the reader is up again. Never allowed to fail the restart: the
    // reader IS restarting, and the member-level Re-send remains the manual
    // fix if this could not be queued.
    let membersQueuedForRepair = 0
    try {
      const memberIds = await this.repo.listMemberIdsOnDevice(
        input.gymId,
        device.device_serial
      )
      const notBefore = new Date(
        Date.now() + REBOOT_RESEAT_DELAY_SECONDS * 1000
      )
      membersQueuedForRepair = await this.repo.enqueueMany(
        input.gymId,
        memberIds.map((memberId) => ({
          memberId,
          intent: AccessIntent.ReconcileMember,
          payload: {
            reason: 'reader_restarted',
            reseat: true,
            deviceSerial: device.device_serial,
          },
          notBefore,
        }))
      )
    } catch (error) {
      console.error('[access-control] restart repair not queued', {
        gymId: input.gymId,
        deviceSerial: device.device_serial,
        message: error instanceof Error ? error.message : 'unknown',
      })
    }

    return { applicable: true, dispatched: true, membersQueuedForRepair }
  }
}
