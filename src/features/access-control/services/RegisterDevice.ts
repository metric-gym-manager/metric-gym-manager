/**
 * Register a reader for a gym.
 *
 * The serial is how an inbound scan finds its gym, so a mistyped one registers
 * a reader that no scan will ever match, while the dashboard shows it as fine
 * (remote day, F-07). Before registering, the serial is therefore checked
 * against the readers on the gym's own VFT account.
 *
 * ## Why the check never blocks on a doubt
 *
 * It is a typo guard, not a gate. It refuses only when the account's reader
 * list was readable, was not empty, and lacked the serial. An unreachable
 * vendor, bad credentials, no credentials yet, or an empty list (which cannot
 * be told apart from "we could not see it") all skip the check: a gym must be
 * able to add its reader whether or not the vendor happens to answer.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import type { AccessDevice } from '@/features/access-control/types'
import type { RegisterDeviceInput } from '@/features/access-control/schemas/access-control.schemas'
import type { IAccessControlRepository } from './IAccessControlRepository'

export interface RegisterDeviceResult {
  /** The registered reader. Absent when the serial was refused. */
  device?: AccessDevice
  /** The VFT account does not list this serial. Nothing was registered. */
  notOnAccount?: boolean
}

export class RegisterDevice {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * @param gymId - Owning gym, from the auth guard — never from the request.
   * @param input - Validated input; the serial is already trimmed and
   *   upper-cased by the schema.
   */
  async execute(
    gymId: string,
    input: RegisterDeviceInput
  ): Promise<RegisterDeviceResult> {
    try {
      const credentials = await this.repo.getCredentials(gymId)

      if (credentials) {
        const serials = (await this.provider.listDevices(credentials)).map(
          (d) => d.serial.trim().toUpperCase()
        )

        if (serials.length > 0 && !serials.includes(input.deviceSerial)) {
          return { notOnAccount: true }
        }
      }
    } catch {
      // The check is a typo guard, not a gate: an unreachable vendor must not
      // stop a gym adding its reader.
    }

    return { device: await this.repo.registerDevice(gymId, input) }
  }
}
