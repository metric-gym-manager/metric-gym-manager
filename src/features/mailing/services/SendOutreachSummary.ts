import { SRI_LANKA_UTC_OFFSET_MINUTES } from '../config/AnnouncementConfig'
import { OUTREACH_SUMMARY_WEEKDAY } from '../config/outreachCampaign'
import { weeklySummaryEmail, type ReportEmail } from '../utils/outreachReports'
import type { IOutreachCampaigns } from './IOutreachCampaigns'
import type { IOutreachLedger } from './IOutreachLedger'
import type { IOwnerMailer } from './IOwnerMailer'

const DAY = 86_400_000

export type SummaryResult =
  | { outcome: 'sent'; id: string }
  /** Not the summary's weekday. */
  | { outcome: 'not_due' }
  /** This week's has gone already. */
  | { outcome: 'already_sent' }
  /** No one left in the series and nothing happened this week. */
  | { outcome: 'over' }

/** `now` as a Sri Lanka calendar date: its weekday and YYYY-MM-DD. */
function sriLankaDay(now: Date): { weekday: number; date: string } {
  const local = new Date(now.getTime() + SRI_LANKA_UTC_OFFSET_MINUTES * 60_000)
  return { weekday: local.getUTCDay(), date: local.toISOString().slice(0, 10) }
}

/**
 * The weekly summary to the owner (owner request, 2026-10-06): the last
 * seven days in numbers and whether the campaign is running, sent by the
 * daily run on `OUTREACH_SUMMARY_WEEKDAY`. At most once a week — the week is
 * claimed in `outreach_campaigns` before the send — and no more once the
 * series has finished and gone quiet.
 */
export class SendOutreachSummary {
  constructor(
    private readonly ledger: IOutreachLedger,
    private readonly campaigns: IOutreachCampaigns,
    private readonly owner: IOwnerMailer
  ) {}

  /**
   * This week's summary, or null when there is nothing left to report.
   * Sends nothing (`scripts/send-outreach.ts --summary` previews with it).
   */
  async compose(campaign: string, now: Date): Promise<ReportEmail | null> {
    const week = await this.ledger.eventCounts(
      campaign,
      new Date(now.getTime() - 7 * DAY)
    )
    const progress = await this.ledger.progress(campaign)
    const quiet = Object.values(week).every((n) => n === 0)
    if (!progress.some((r) => r.status === 'active') && quiet) return null
    const state = await this.campaigns.state(campaign)
    return weeklySummaryEmail({
      campaign,
      now,
      week,
      progress,
      paused: state.pausedAt
        ? { since: state.pausedAt, reason: state.pauseReason ?? 'paused' }
        : null,
    })
  }

  /**
   * Send a composed summary now, outside the weekly schedule (the owner's
   * `--summary --apply`); Monday's still goes.
   */
  async sendNow(email: ReportEmail): Promise<string> {
    return this.owner.send({
      ...email,
      idempotencyKey: `outreach-summary-now:${crypto.randomUUID()}`,
    })
  }

  /** Send this week's summary if today is the day and it has not gone yet. */
  async sendIfDue(campaign: string, now: Date): Promise<SummaryResult> {
    const day = sriLankaDay(now)
    if (day.weekday !== OUTREACH_SUMMARY_WEEKDAY) return { outcome: 'not_due' }
    const email = await this.compose(campaign, now)
    if (!email) return { outcome: 'over' }
    const notSince = new Date(now.getTime() - 6 * DAY)
    if (!(await this.campaigns.claimSummary(campaign, now, notSince))) {
      return { outcome: 'already_sent' }
    }
    const id = await this.owner.send({
      ...email,
      idempotencyKey: `outreach-summary:${campaign}:${day.date}`,
    })
    return { outcome: 'sent', id }
  }
}
