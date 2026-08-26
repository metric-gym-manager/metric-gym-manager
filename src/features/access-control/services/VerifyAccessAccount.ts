/**
 * Credential probe.
 *
 * Saving credentials proves nothing — a typo in the base URL or a password the
 * gym's IT changed last month both look identical in the database. This signs
 * in for real and stamps `last_verified_at`, so the settings page can say
 * "connected" on evidence rather than on the fact that a form was submitted.
 *
 * A failure here returns `false`; it never throws the vendor's words at a gym
 * manager (rules 2.8 / 2.9). The SaaS-admin health view keeps the raw truth.
 */

import type { IAccessControlProvider } from '@/lib/access-control'
import type { IAccessControlRepository } from './IAccessControlRepository'

export interface VerifyAccessAccountResult {
  /** False when the gym has no access control configured. */
  applicable: boolean
  /** Whether the vendor accepted our credentials. */
  verified: boolean
}

export class VerifyAccessAccount {
  constructor(
    private readonly repo: IAccessControlRepository,
    private readonly provider: IAccessControlProvider
  ) {}

  /**
   * Sign in with the gym's stored credentials.
   *
   * @param gymId - The gym whose credentials to probe.
   */
  async execute(gymId: string): Promise<VerifyAccessAccountResult> {
    const credentials = await this.repo.getCredentials(gymId)
    if (!credentials) return { applicable: false, verified: false }

    try {
      const verified = await this.provider.verifyCredentials(credentials)

      if (verified) {
        await this.repo.markAccountVerified(gymId)
      }

      return { applicable: true, verified }
    } catch {
      // A transport failure is indistinguishable from bad credentials to the
      // person reading the screen, and both mean the same thing to them: it is
      // not working yet.
      return { applicable: true, verified: false }
    }
  }
}
