import type { Prospect } from '../utils/prospectsCsv'

/**
 * Where an address stands in an outreach series:
 * - `active`: still receiving the series (`step` emails sent so far);
 * - `done`: all four sent;
 * - `unsubscribed`: opted out, or taken out on request — never written to again;
 * - `failed`: sends kept failing; given up.
 */
export type OutreachStatus = 'active' | 'done' | 'unsubscribed' | 'failed'

/** An address due its next email. */
export interface OutreachRecipient {
  email: string
  gymName: string | null
  name: string | null
  /** Emails of the series sent so far, 0 to 4. */
  step: number
}

/**
 * The record of a campaign's recipients — one row per address, unique per
 * campaign — and so the guard against emailing anyone out of turn. It also
 * records where each address came from.
 */
export interface IOutreachLedger {
  /** Insert new addresses as `active` at step 0; returns the ones that were new. */
  addRecipients(
    campaign: string,
    prospects: Prospect[],
    defaultSource: string
  ): Promise<string[]>
  /** Every address already in the campaign, with its status. */
  recipients(campaign: string): Promise<Map<string, OutreachStatus>>
  /** Active addresses with emails left, not written to since `notSentSince`, oldest first. */
  due(
    campaign: string,
    notSentSince: Date,
    limit: number
  ): Promise<OutreachRecipient[]>
  /**
   * Move an address from `fromStep` to the next, BEFORE sending. False when
   * it is no longer at `fromStep` or no longer active: another run has it.
   */
  claim(
    campaign: string,
    email: string,
    fromStep: number,
    at: Date
  ): Promise<boolean>
  /** Record a delivered send; the fourth marks the address `done`. */
  recordSent(
    campaign: string,
    email: string,
    step: number,
    resendEmailId: string
  ): Promise<void>
  /** Undo a claim whose send failed; repeated failures mark it `failed`. */
  recordFailure(
    campaign: string,
    email: string,
    revertTo: number,
    error: string
  ): Promise<void>
  /** End the series for an address that has since become a gym or a demo request. */
  markDone(campaign: string, email: string): Promise<void>
  /** Never write to this address again. False when it is not in the campaign. */
  markUnsubscribed(campaign: string, email: string): Promise<boolean>
}
