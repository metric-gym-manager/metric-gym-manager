import type { Prospect } from '../utils/prospectsCsv'

/**
 * Where an outreach address stands in a campaign:
 * - `pending`: recorded, not yet sent (a later run sends it);
 * - `sent`: the introduction went out;
 * - `skipped`: the address had unsubscribed;
 * - `failed`: Resend refused it (the error is kept).
 */
export type OutreachStatus = 'pending' | 'sent' | 'skipped' | 'failed'

export interface OutreachPatch {
  status: OutreachStatus
  resendEmailId?: string
  error?: string
}

/**
 * The record of a campaign's recipients — one row per address, unique per
 * campaign — and so the guard against emailing anyone twice. It is also the
 * record of where each address came from.
 */
export interface IOutreachLedger {
  /** Insert new addresses as `pending`; existing ones are left alone. Returns how many were new. */
  addRecipients(
    campaign: string,
    prospects: Prospect[],
    source: string
  ): Promise<number>
  /** Every address already in the campaign, with its status. */
  recipients(campaign: string): Promise<Map<string, OutreachStatus>>
  /** The next addresses to send, oldest first. */
  pending(campaign: string, limit: number): Promise<Prospect[]>
  /** Throws when no row changed: a no-op must not pass for a write. */
  mark(campaign: string, email: string, patch: OutreachPatch): Promise<void>
}
