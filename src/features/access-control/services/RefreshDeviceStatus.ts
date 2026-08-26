/**
 * Refresh what we know about each reader from the vendor.
 *
 * ## Why this exists at all
 *
 * We already stamp `last_seen_at` when a scan arrives on the webhook, and that
 * is genuine evidence — but it is evidence of *members*, not of the reader.
 * A gym that closes at 10pm produces no scans overnight, so contact-from-scans
 * alone would show every reader as offline by morning.
 *
 * That matters more than it sounds. The device card's whole job is to stop
 * staff panicking about an offline reader, because the door keeps working from
 * the terminal's own records. A dashboard that cries offline every night
 * teaches people to ignore it, and then the one real outage is ignored too.
 *
 * ## What we can honestly claim
 *
 * The vendor's device listing is the better source — it is talking to the
 * hardware, we are only watching scans. But **no presence field is documented**
 * (see the simulator plan, A-2), so this takes whatever it can get and reports
 * `unknown` rather than inventing a verdict:
 *
 *   * vendor gives an explicit online flag  → use it
 *   * vendor gives a last-activity time     → use it as contact
 *   * vendor gives neither                  → fall back to scan contact, and
 *                                             the reader is "last seen X ago"
 *                                             rather than "offline"
 *
 * A device we have registered that the vendor does not list at all is reported
 * separately: that is a real misconfiguration (wrong account, wrong serial,
 * device removed on their side) and it deserves a different answer than
 * "offline".
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import type { IAccessControlRepository } from './IAccessControlRepository'

export interface RefreshDeviceStatusInput {
  /** Limit to one gym. Omit to sweep every gym with access control. */
  gymId?: string
}

export interface RefreshDeviceStatusSummary {
  gymsChecked: number
  devicesChecked: number
  /** Readers whose contact time we managed to advance. */
  devicesSeen: number
  /**
   * Serials registered here that the vendor does not know.
   *
   * A configuration problem, not an outage — wrong account, mistyped serial,
   * or the device was removed on their side.
   */
  unknownToVendor: string[]
  errors: string[]
}

export class RefreshDeviceStatus {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Bring device presence up to date from the vendor.
   *
   * @param input - Optionally a single gym.
   */
  async execute(
    input: RefreshDeviceStatusInput = {}
  ): Promise<RefreshDeviceStatusSummary> {
    const summary: RefreshDeviceStatusSummary = {
      gymsChecked: 0,
      devicesChecked: 0,
      devicesSeen: 0,
      unknownToVendor: [],
      errors: [],
    }

    const gymIds = input.gymId
      ? [input.gymId]
      : await this.repo.listGymsWithAccessControl()

    for (const gymId of gymIds) {
      // One gym's vendor account being unreachable says nothing about the
      // others, so the sweep continues.
      try {
        const credentials = await this.repo.getCredentials(gymId)
        if (!credentials) continue

        const ours = await this.repo.listDevices(gymId)
        const active = ours.filter((d) => d.is_active)
        if (active.length === 0) continue

        summary.gymsChecked += 1
        summary.devicesChecked += active.length

        const theirs = await this.provider.listDevices(credentials)
        const bySerial = new Map(theirs.map((d) => [d.serial, d]))

        for (const device of active) {
          const vendor = bySerial.get(device.device_serial)

          if (!vendor) {
            summary.unknownToVendor.push(device.device_serial)
            continue
          }

          // An explicit online flag is taken as contact now; otherwise use the
          // vendor's own last-activity time. Neither present means we learned
          // nothing here, and the scan-derived time stands.
          const seenAt =
            vendor.online === true ? new Date() : (vendor.lastSeenAt ?? null)

          if (!seenAt) continue

          await this.repo.markDeviceSeen(device.device_serial, seenAt)
          summary.devicesSeen += 1
        }
      } catch (error) {
        summary.errors.push(
          `Gym ${gymId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return summary
  }
}
