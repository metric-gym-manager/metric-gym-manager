/**
 * Keep names in step with the vendor.
 *
 * ## Why this is worth its own use case
 *
 * Nothing about access *works* differently if a name drifts — the door is
 * driven by subject ids and validity windows, not by labels. But the labels
 * are what a human reads:
 *
 * - A member changes their name in our app. The reader, the vendor console
 *   and any report VFT produces keep the old one **for ever**, because
 *   nothing ever told them otherwise.
 * - A gym renames "Device 2" to "Side Door" in our settings. Our list says
 *   Side Door, VFT's says Device 2, and the next person comparing the two
 *   has to work out which is authoritative.
 *
 * Both are the kind of small divergence that costs an hour of confusion at
 * exactly the wrong moment — during an incident, when someone is reading both
 * screens at once.
 *
 * ## Failure posture
 *
 * A rename that does not reach the vendor is a cosmetic problem, so it is
 * reported and never escalated: it must not fail the edit that triggered it,
 * and it is not worth an outbox job and a retry budget. If it fails, the
 * name is stale until the next rename — which is exactly as bad as it was
 * before this existed, and no worse.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import type { IAccessControlRepository } from './IAccessControlRepository'

export interface PushRenameResult {
  /** False when the gym has no access control configured. */
  applicable: boolean
  /** True once the vendor accepted the rename. */
  pushed: boolean
}

export class PushRename {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Push a member's new name to the vendor.
   *
   * Silently does nothing for a member who has never been provisioned: there
   * is no vendor record to rename, and the name will be correct whenever they
   * are first pushed.
   *
   * @param gymId - Owning gym, checked against the member's own.
   * @param memberId - The member whose name changed.
   */
  async member(gymId: string, memberId: string): Promise<PushRenameResult> {
    const credentials = await this.repo.getCredentials(gymId)
    if (!credentials) return { applicable: false, pushed: false }

    const context = await this.repo.getMemberAccessContext(memberId)

    if (
      !context ||
      context.gymId !== gymId ||
      !context.subject ||
      !context.subject.provisioned_at
    ) {
      return { applicable: false, pushed: false }
    }

    const outcome = await this.provider.renameSubject(
      credentials,
      String(context.subject.subject_id),
      context.memberName
    )

    return { applicable: true, pushed: outcome.status !== 'failed' }
  }

  /**
   * Push a reader's new name to the vendor.
   *
   * @param gymId - Owning gym; the device is resolved against it, never by id
   *   alone, because the vendor token reaches every terminal on the account.
   * @param deviceId - The reader that was renamed.
   */
  async device(gymId: string, deviceId: string): Promise<PushRenameResult> {
    const credentials = await this.repo.getCredentials(gymId)
    if (!credentials) return { applicable: false, pushed: false }

    const device = await this.repo.findDeviceById(gymId, deviceId)
    if (!device) return { applicable: false, pushed: false }

    const outcome = await this.provider.renameDevice(
      credentials,
      device.device_serial,
      device.device_name
    )

    return { applicable: true, pushed: outcome.status !== 'failed' }
  }
}
