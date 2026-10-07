import type { Prospect } from '../utils/prospectsCsv'

/**
 * Where an address stands in an outreach series:
 * - `active`: still receiving the series (`step` emails sent so far);
 * - `done`: all four sent;
 * - `unsubscribed`: opted out, or taken out on request — never written to again;
 * - `failed`: sends kept failing; given up;
 * - `bounced`: the address does not exist, or Resend will not deliver to it;
 * - `complained`: the recipient marked an email as spam.
 */
export type OutreachStatus =
  'active' | 'done' | 'unsubscribed' | 'failed' | 'bounced' | 'complained'

/** The ways a series is stopped from outside the run: never written to again. */
export type OutreachStop = 'unsubscribed' | 'bounced' | 'complained'

/**
 * What `outreach_events` records: each email sent, and each series stopped.
 * `suppressed` stops an address as `bounced` without counting as a new bounce:
 * Resend refused to try, so no mail provider saw it.
 */
export type OutreachEventType =
  'sent' | 'unsubscribed' | 'bounced' | 'complained' | 'suppressed'

export type OutreachEventCounts = Record<OutreachEventType, number>

export interface StopOptions {
  /** Only this campaign; every campaign the address is in when absent. */
  campaign?: string
  /** Recorded with the event, e.g. the bounce message. */
  detail?: string
  /** The event to record when it is not the status itself (`suppressed`). */
  event?: OutreachEventType
}

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
  /** Record a delivered send, and its `sent` event; the fourth marks the address `done`. */
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
  /**
   * Never write to this address again. Moves it to `status` in each campaign
   * where its status is a weaker one (active, done, failed < unsubscribed <
   * bounced < complained), and records an event for each such move — so a
   * webhook delivered twice records nothing the second time.
   *
   * @returns The campaigns whose row changed
   */
  stop(
    email: string,
    status: OutreachStop,
    options?: StopOptions
  ): Promise<string[]>
  /** Events of a campaign since a moment, counted by type. */
  eventCounts(campaign: string, since: Date): Promise<OutreachEventCounts>
  /** Every address of a campaign: its status and the emails it has had. */
  progress(
    campaign: string
  ): Promise<{ status: OutreachStatus; step: number }[]>
}
