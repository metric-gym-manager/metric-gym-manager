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
import { mailboxKey } from '../utils/emailAddress'
import type { Prospect } from '../utils/prospectsCsv'
import {
  createUnsubscribeToken,
  normalizeMailingEmail,
} from '../utils/unsubscribeToken'
import type { IOutreachLedger } from './IOutreachLedger'
import type { IOutreachSender } from './IOutreachSender'
import type { OutreachBrake } from './OutreachBrake'

/** The one-click unsubscribe endpoint mail apps POST to (RFC 8058). */
export const ONE_CLICK_UNSUBSCRIBE_PATH =
  '/api/public/email-preferences/one-click'

const DAY = 86_400_000

export type OutreachOutcome =
  | 'known'
  | 'imported'
  | 'sent'
  | 'skipped'
  | 'failed'
  | 'deferred'
  | 'would_send'

export interface OutreachReport {
  counts: Record<OutreachOutcome, number>
  entries: {
    email: string
    outcome: OutreachOutcome
    step?: number
    detail?: string
  }[]
  /** Set when the campaign is paused: nothing more was sent. */
  paused?: { since: Date; reason: string }
  /** A dry run's brake verdict: the real run would pause for this. */
  wouldPause?: string
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
  /**
   * No new send is started after this moment; the rest stay due for the next
   * run. A run cut off by the function's time limit mid-send would leave a
   * claimed email unsent, so the cron stops well before that limit.
   */
  deadline?: Date
}

function emptyReport(): OutreachReport {
  return {
    counts: {
      known: 0,
      imported: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      deferred: 0,
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
 * - Nothing is sent while the campaign is paused. The safety brake is
 *   checked before the run starts and again before every send, so bounces
 *   and complaints arriving mid-run (the webhook) stop it at the next address.
 */
export class SendOutreach {
  constructor(
    private readonly ledger: IOutreachLedger,
    private readonly sender: IOutreachSender,
    private readonly listKnownEmails: () => Promise<string[]>,
    private readonly secret: string,
    private readonly brake: OutreachBrake
  ) {}

  /** Take the list in: record new addresses and add them to Resend's contacts. Sends nothing. */
  async importProspects(input: ImportProspectsInput): Promise<OutreachReport> {
    const report = emptyReport()
    // Compared by inbox, not spelling: `owner+promo@gmail.com` is the gym
    // owner's own inbox.
    const known = new Set((await this.listKnownEmails()).map(mailboxKey))
    const fresh: Prospect[] = []
    for (const prospect of input.prospects) {
      if (known.has(mailboxKey(prospect.email))) {
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
    const record = (
      email: string,
      outcome: OutreachOutcome,
      extra: { step?: number; detail?: string } = {}
    ) => {
      report.counts[outcome] += 1
      report.entries.push({ email, outcome, ...extra })
    }
    const brake = await this.brake.check(input.campaign, input.now, {
      dryRun: input.dryRun,
    })
    if (brake.paused) {
      report.paused = { since: brake.since, reason: brake.reason }
      return report
    }
    if (brake.wouldPause) report.wouldPause = brake.wouldPause

    const notSentSince = new Date(
      input.now.getTime() - OUTREACH_MIN_GAP_DAYS * DAY
    )
    const due = await this.ledger.due(input.campaign, notSentSince, input.limit)
    // Someone imported last month may have signed up or asked for a demo
    // since: they are a customer or a lead now, not a prospect.
    const known = new Set((await this.listKnownEmails()).map(mailboxKey))

    for (const recipient of due) {
      const step = (recipient.step + 1) as OutreachStep
      if (step > OUTREACH_SEQUENCE_LENGTH) continue
      if (known.has(mailboxKey(recipient.email))) {
        // A dry run says so and writes nothing.
        if (!input.dryRun) {
          await this.ledger.markDone(input.campaign, recipient.email)
        }
        record(recipient.email, 'known', {
          detail: 'now a gym or a demo request',
        })
        continue
      }
      if (input.dryRun) {
        record(recipient.email, 'would_send', { step })
        continue
      }
      if (input.deadline && Date.now() > input.deadline.getTime()) {
        record(recipient.email, 'deferred', {
          step,
          detail: 'out of time; next run',
        })
        continue
      }

      // One address's trouble must never stop the rest of the run.
      let reachable: boolean
      try {
        reachable = await this.sender.canReceiveMarketing(recipient.email)
      } catch (error) {
        record(recipient.email, 'failed', {
          step,
          detail: `could not check: ${error instanceof Error ? error.message : String(error)}`,
        })
        continue
      }
      if (!reachable) {
        await this.ledger.stop(recipient.email, 'unsubscribed', {
          campaign: input.campaign,
        })
        record(recipient.email, 'skipped', { detail: 'unsubscribed' })
        continue
      }

      // A bounce or complaint arriving mid-run may have paused it.
      const now = await this.brake.check(input.campaign, input.now)
      if (now.paused) {
        report.paused = { since: now.since, reason: now.reason }
        break
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
        record(recipient.email, 'sent', { step })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await this.ledger.recordFailure(
          input.campaign,
          recipient.email,
          recipient.step,
          message
        )
        record(recipient.email, 'failed', { step, detail: message })
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
    // A fresh key per test: Resend keeps a key for 24 hours and refuses it
    // with a changed body, so a fixed one blocked re-testing after an edit.
    return this.sendStep('test', address, step, `test-${crypto.randomUUID()}`)
  }

  /**
   * Take an address out of the campaign; it is never written to again.
   *
   * @returns False when the address is not in the campaign
   */
  async remove(campaign: string, email: string): Promise<boolean> {
    const address = normalizeMailingEmail(email)
    const stopped = await this.ledger.stop(address, 'unsubscribed', {
      campaign,
      detail: 'taken out on request',
    })
    return (
      stopped.length > 0 ||
      (await this.ledger.recipients(campaign)).has(address)
    )
  }

  private async sendStep(
    campaign: string,
    email: string,
    step: OutreachStep,
    attempt = 'campaign'
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
      idempotencyKey:
        attempt === 'campaign'
          ? `outreach:${campaign}:${step}:${email}`
          : `outreach:${attempt}:${step}:${email}`,
    })
  }
}
