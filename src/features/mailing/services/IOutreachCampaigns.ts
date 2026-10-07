/** A campaign's switches: paused by the brake or the owner, and its weekly summary. */
export interface OutreachCampaignState {
  /** Set while the campaign is paused: nothing is sent. */
  pausedAt: Date | null
  pauseReason: string | null
  /** When the owner was told of this pause; null while the alert is owed. */
  pauseAlertedAt: Date | null
  /** The brake counts from here (or from the start, when never resumed). */
  resumedAt: Date | null
  lastSummaryAt: Date | null
}

/** The `outreach_campaigns` record. A campaign with no row is running. */
export interface IOutreachCampaigns {
  state(campaign: string): Promise<OutreachCampaignState>
  /**
   * Pause a running campaign. False when it was already paused, so only one
   * caller ever owns a pause (and sends its alert).
   *
   * @param alerted - True when the owner paused it and needs no alert
   */
  pause(
    campaign: string,
    reason: string,
    at: Date,
    alerted: boolean
  ): Promise<boolean>
  markPauseAlerted(campaign: string, at: Date): Promise<void>
  /** Resume a paused campaign; the brake counts from `at`. False when it was running. */
  resume(campaign: string, at: Date): Promise<boolean>
  /**
   * Claim this week's summary: true for exactly one caller, and only when the
   * last one went before `notSince`.
   */
  claimSummary(campaign: string, at: Date, notSince: Date): Promise<boolean>
}
