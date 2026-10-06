import { SITE_URL } from '@/features/marketing/config/site'
import {
  MailingTopic,
  RESEND_TOPIC_IDS,
  UNSUBSCRIBE_PATH,
} from '../config/MailingConfig'
import {
  OUTREACH_MIN_GAP_DAYS,
  OUTREACH_SEQUENCE_LENGTH,
  outreachEmail,
  type OutreachStep,
} from '../config/outreachCampaign'
import type { Prospect } from '../utils/prospectsCsv'
import {
  createUnsubscribeToken,
  normalizeMailingEmail,
} from '../utils/unsubscribeToken'
import type { IOutreachLedger } from './IOutreachLedger'
import type { IOutreachSender } from './IOutreachSender'

/** The one-click unsubscribe endpoint mail apps POST to (RFC 8058). */
export const ONE_CLICK_UNSUBSCRIBE_PATH =
  '/api/public/email-preferences/one-click'

const DAY = 86_400_000

export type OutreachOutcome =
  'known' | 'imported' | 'sent' | 'skipped' | 'failed' | 'would_send'

export interface OutreachReport {
  counts: Record<OutreachOutcome, number>
  entries: {
    email: string
    outcome: OutreachOutcome
    step?: number
    detail?: string
  }[]
}

export interface ImportProspectsInput {
  campaign: string
  /** From the CSV: unique, lowercased, deliverable (`parseProspectsCsv`). */
  prospects: Prospect[]
  /** Recorded for a row whose CSV gave no website. */
  defaultSource: string
  dryRun: boolean
}

export interface RunWeekInput {
  campaign: string
  now: Date
  /** Sends this run, at most. */
  limit: number
  dryRun: boolean
}

function emptyReport(): OutreachReport {
  return {
    counts: {
      known: 0,
      imported: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      would_send: 0,
    },
    entries: [],
  }
}

/**
 * A four-email introduction series to gyms whose contact details are on
 * public pages (owner request, 2026-10-06), one email a week.
 *
 * - Existing gyms and everyone who requested a demo are never taken in:
 *   customers already use the product, and a demo request without the
 *   consent box ticked must not be marketed to.
 * - Each address gets emails 1 to 4 in order, at least
 *   `OUTREACH_MIN_GAP_DAYS` apart, then no more. The step is CLAIMED in the
 *   ledger before the send, so two runs never send the same email twice, and
 *   Resend is given an idempotency key per address and step.
 * - Before every send the address is checked: once it has opted out of
 *   Marketing (the footer link, a mail app's one-click button, or
 *   everything), it is marked `unsubscribed` and never written to again.
 * - Every email carries the recipient's own signed /unsubscribe link and a
 *   one-click List-Unsubscribe URL, and is tagged in Resend by campaign and
 *   email number.
 */
export class SendOutreach {
  constructor(
    private readonly ledger: IOutreachLedger,
    private readonly sender: IOutreachSender,
    private readonly listKnownEmails: () => Promise<string[]>,
    private readonly secret: string
  ) {}

  /** Take the list in: record new addresses and add them to Resend's contacts. Sends nothing. */
  async importProspects(input: ImportProspectsInput): Promise<OutreachReport> {
    const report = emptyReport()
    const known = new Set(
      (await this.listKnownEmails()).map(normalizeMailingEmail)
    )
    const fresh: Prospect[] = []
    for (const prospect of input.prospects) {
      if (known.has(normalizeMailingEmail(prospect.email))) {
        report.counts.known += 1
        report.entries.push({
          email: prospect.email,
          outcome: 'known',
          detail: 'already a gym or a demo request',
        })
      } else {
        fresh.push(prospect)
      }
    }

    if (input.dryRun) {
      const existing = await this.ledger.recipients(input.campaign)
      for (const p of fresh.filter((p) => !existing.has(p.email))) {
        report.counts.imported += 1
        report.entries.push({ email: p.email, outcome: 'imported' })
      }
      return report
    }

    const added = new Set(
      await this.ledger.addRecipients(
        input.campaign,
        fresh,
        input.defaultSource
      )
    )
    for (const p of fresh.filter((p) => added.has(p.email))) {
      await this.sender.ensureContact(
        p.email,
        createUnsubscribeToken(p.email, this.secret),
        p.gymName
      )
      report.counts.imported += 1
      report.entries.push({ email: p.email, outcome: 'imported' })
    }
    return report
  }

  /** The weekly run: each due address gets its next email of the four. */
  async runWeek(input: RunWeekInput): Promise<OutreachReport> {
    const report = emptyReport()
    const notSentSince = new Date(
      input.now.getTime() - OUTREACH_MIN_GAP_DAYS * DAY
    )
    const due = await this.ledger.due(input.campaign, notSentSince, input.limit)

    for (const recipient of due) {
      const step = (recipient.step + 1) as OutreachStep
      if (step > OUTREACH_SEQUENCE_LENGTH) continue
      if (input.dryRun) {
        report.counts.would_send += 1
        report.entries.push({
          email: recipient.email,
          outcome: 'would_send',
          step,
        })
        continue
      }

      if (!(await this.sender.canReceiveMarketing(recipient.email))) {
        await this.ledger.markUnsubscribed(input.campaign, recipient.email)
        report.counts.skipped += 1
        report.entries.push({
          email: recipient.email,
          outcome: 'skipped',
          detail: 'unsubscribed',
        })
        continue
      }

      if (
        !(await this.ledger.claim(
          input.campaign,
          recipient.email,
          recipient.step,
          input.now
        ))
      ) {
        continue
      }

      try {
        const id = await this.sendStep(input.campaign, recipient.email, step)
        await this.ledger.recordSent(input.campaign, recipient.email, step, id)
        report.counts.sent += 1
        report.entries.push({ email: recipient.email, outcome: 'sent', step })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await this.ledger.recordFailure(
          input.campaign,
          recipient.email,
          recipient.step,
          message
        )
        report.counts.failed += 1
        report.entries.push({
          email: recipient.email,
          outcome: 'failed',
          step,
          detail: message,
        })
      }
    }
    return report
  }

  /**
   * One email of the four to one address, outside any campaign: the owner's
   * check of how it arrives.
   *
   * @returns Resend's id, or `null` when the address has unsubscribed
   */
  async sendTest(email: string, step: OutreachStep): Promise<string | null> {
    const address = normalizeMailingEmail(email)
    await this.sender.ensureContact(
      address,
      createUnsubscribeToken(address, this.secret),
      null
    )
    if (!(await this.sender.canReceiveMarketing(address))) return null
    return this.sendStep('test', address, step)
  }

  /** Take an address out of the campaign; it is never written to again. */
  async remove(campaign: string, email: string): Promise<boolean> {
    return this.ledger.markUnsubscribed(campaign, normalizeMailingEmail(email))
  }

  private async sendStep(
    campaign: string,
    email: string,
    step: OutreachStep
  ): Promise<string> {
    const token = createUnsubscribeToken(email, this.secret)
    const link = (path: string) => {
      const url = new URL(`${SITE_URL}${path}`)
      url.searchParams.set('email', email)
      url.searchParams.set('token', token)
      url.searchParams.set('topic', MailingTopic.Marketing)
      return url.toString()
    }
    const unsubscribeUrl = link(UNSUBSCRIBE_PATH)
    return this.sender.send({
      to: email,
      ...outreachEmail(step, { unsubscribeUrl }),
      unsubscribeUrl,
      oneClickUrl: link(ONE_CLICK_UNSUBSCRIBE_PATH),
      topicId: RESEND_TOPIC_IDS[MailingTopic.Marketing],
      tags: [
        { name: 'kind', value: 'outreach' },
        { name: 'campaign', value: campaign },
        { name: 'email', value: String(step) },
      ],
      idempotencyKey: `outreach:${campaign}:${step}:${email}`,
    })
  }
}
