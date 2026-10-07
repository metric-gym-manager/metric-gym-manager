import { OUTREACH_BRAKE } from '../config/outreachCampaign'
import { pausedAlertEmail, percent } from '../utils/outreachReports'
import type { IOutreachCampaigns } from './IOutreachCampaigns'
import type { IOutreachLedger, OutreachEventCounts } from './IOutreachLedger'
import type { IOwnerMailer } from './IOwnerMailer'

export type BrakeState =
  | {
      paused: false
      /** A dry run's verdict, not acted on. */ wouldPause?: string
    }
  | { paused: true; since: Date; reason: string }

const EPOCH = new Date(0)

/**
 * Why the brake would pause on these counts, or null.
 *
 * @param counts - Events since the start, or since the last resume
 * @returns e.g. "2 spam complaints", "3 of 40 emails bounced (7.5%)"
 */
export function brakeReason(counts: OutreachEventCounts): string | null {
  if (counts.complained >= OUTREACH_BRAKE.complaints) {
    return `${counts.complained} spam complaints`
  }
  if (
    counts.sent >= OUTREACH_BRAKE.minSendsForBounceRate &&
    counts.bounced / counts.sent > OUTREACH_BRAKE.bounceRate
  ) {
    return `${counts.bounced} of ${counts.sent} emails bounced (${percent(counts.bounced, counts.sent)})`
  }
  return null
}

/**
 * The safety brake (owner request, 2026-10-06): a campaign pauses itself when
 * spam complaints or hard bounces pass `OUTREACH_BRAKE`, before mail
 * providers start treating the domain as a spammer's, and the owner is told.
 *
 * Checked by the webhook as each bounce or complaint arrives, and by the
 * daily run before it starts and before every send. A pause is owned by the
 * one caller whose conditional write set it; the alert is at-least-once (a
 * failed send leaves it owed, and the next check sends it) and Resend's
 * idempotency key keeps a retry from doubling it. Only the owner resumes.
 */
export class OutreachBrake {
  constructor(
    private readonly ledger: IOutreachLedger,
    private readonly campaigns: IOutreachCampaigns,
    private readonly owner: IOwnerMailer
  ) {}

  /**
   * Pause the campaign if the counts call for it, alert the owner if that is
   * owed, and say whether it may send.
   *
   * @throws When the alert cannot be sent (the pause stands, the alert stays owed)
   */
  async check(
    campaign: string,
    now: Date,
    options: { dryRun?: boolean } = {}
  ): Promise<BrakeState> {
    let state = await this.campaigns.state(campaign)
    if (!state.pausedAt) {
      const counts = await this.ledger.eventCounts(
        campaign,
        state.resumedAt ?? EPOCH
      )
      const reason = brakeReason(counts)
      if (!reason) return { paused: false }
      if (options.dryRun) return { paused: false, wouldPause: reason }
      await this.campaigns.pause(campaign, reason, now, false)
      // Re-read: a concurrent caller may have paused it first, for its reason.
      state = await this.campaigns.state(campaign)
      if (!state.pausedAt) return { paused: false }
    }

    const since = state.pausedAt
    const reason = state.pauseReason ?? 'paused'
    if (!state.pauseAlertedAt && !options.dryRun) {
      await this.owner.send({
        ...pausedAlertEmail({
          campaign,
          reason,
          pausedAt: since,
          resumedAt: state.resumedAt,
          counts: await this.ledger.eventCounts(
            campaign,
            state.resumedAt ?? EPOCH
          ),
        }),
        idempotencyKey: `outreach-paused:${campaign}:${since.toISOString()}`,
      })
      await this.campaigns.markPauseAlerted(campaign, now)
    }
    return { paused: true, since, reason }
  }

  /** One cheap read, for the run to make before every send. */
  async isPaused(campaign: string): Promise<boolean> {
    return (await this.campaigns.state(campaign)).pausedAt !== null
  }

  /** The owner's own pause: no alert to themselves. False when already paused. */
  async pause(campaign: string, reason: string, at: Date): Promise<boolean> {
    return this.campaigns.pause(campaign, reason, at, true)
  }

  /** The owner's resume; the brake counts afresh from `at`. False when it was running. */
  async resume(campaign: string, at: Date): Promise<boolean> {
    return this.campaigns.resume(campaign, at)
  }
}
