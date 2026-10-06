import { SITE_URL } from '@/features/marketing/config/site'
import {
  MailingTopic,
  RESEND_TOPIC_IDS,
  UNSUBSCRIBE_PATH,
} from '../config/MailingConfig'
import { introCampaignEmail } from '../config/outreachCampaign'
import type { Prospect } from '../utils/prospectsCsv'
import {
  createUnsubscribeToken,
  normalizeMailingEmail,
} from '../utils/unsubscribeToken'
import type { IOutreachLedger } from './IOutreachLedger'
import type { IOutreachSender } from './IOutreachSender'

export interface SendOutreachInput {
  campaign: string
  /** From the CSV: unique, lowercased, deliverable (`parseProspectsCsv`). */
  prospects: Prospect[]
  /** Where the addresses came from, recorded with each one. */
  source: string
  /** Sends this run. */
  limit: number
  /** Report what would happen; record, create and send nothing. */
  dryRun: boolean
}

export type OutreachOutcome =
  'known' | 'sent' | 'skipped' | 'failed' | 'would_send'

export interface OutreachReport {
  counts: Record<OutreachOutcome | 'imported', number>
  entries: { email: string; outcome: OutreachOutcome; detail?: string }[]
}

/**
 * An introduction campaign to addresses outside the product (owner request,
 * 2026-10-06): gyms whose contact details are on public pages.
 *
 * - Existing gyms and everyone who requested a demo are left out: customers
 *   already use the product, and a demo request without the consent box
 *   ticked must not be marketed to.
 * - Every address is recorded in the ledger BEFORE anything is sent, unique
 *   per campaign, so no address gets the same campaign twice.
 * - Each send is preceded by an opt-out check, and each email carries the
 *   recipient's own signed /unsubscribe link on the Marketing topic.
 * - `limit` sends per run: a new sending domain earns trust slowly.
 */
export class SendOutreach {
  constructor(
    private readonly ledger: IOutreachLedger,
    private readonly sender: IOutreachSender,
    private readonly listKnownEmails: () => Promise<string[]>,
    private readonly secret: string
  ) {}

  async execute(input: SendOutreachInput): Promise<OutreachReport> {
    const report: OutreachReport = {
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
    const record = (
      email: string,
      outcome: OutreachOutcome,
      detail?: string
    ) => {
      report.counts[outcome] += 1
      report.entries.push({ email, outcome, ...(detail ? { detail } : {}) })
    }

    const known = new Set(
      (await this.listKnownEmails()).map(normalizeMailingEmail)
    )
    const fresh: Prospect[] = []
    for (const prospect of input.prospects) {
      if (known.has(normalizeMailingEmail(prospect.email))) {
        record(prospect.email, 'known', 'already a gym or a demo request')
      } else {
        fresh.push(prospect)
      }
    }

    if (input.dryRun) {
      const existing = await this.ledger.recipients(input.campaign)
      const added = fresh.filter((p) => !existing.has(p.email))
      report.counts.imported = added.length
      const queued = await this.ledger.pending(input.campaign, input.limit)
      for (const p of [...queued, ...added].slice(0, input.limit)) {
        record(p.email, 'would_send')
      }
      return report
    }

    report.counts.imported = await this.ledger.addRecipients(
      input.campaign,
      fresh,
      input.source
    )

    for (const prospect of await this.ledger.pending(
      input.campaign,
      input.limit
    )) {
      try {
        const sent = await this.sendTo(prospect)
        if (sent === null) {
          await this.ledger.mark(input.campaign, prospect.email, {
            status: 'skipped',
          })
          record(prospect.email, 'skipped', 'unsubscribed')
          continue
        }
        await this.ledger.mark(input.campaign, prospect.email, {
          status: 'sent',
          resendEmailId: sent,
        })
        record(prospect.email, 'sent')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await this.ledger.mark(input.campaign, prospect.email, {
          status: 'failed',
          error: message,
        })
        record(prospect.email, 'failed', message)
      }
    }
    return report
  }

  /**
   * One introduction to one address, outside any campaign: the owner's own
   * check of how it arrives.
   *
   * @param email - Where to send it
   * @returns Resend's id, or `null` when the address has unsubscribed
   */
  async sendTest(email: string): Promise<string | null> {
    return this.sendTo({
      email: normalizeMailingEmail(email),
      gymName: null,
      name: null,
    })
  }

  /** `null` when the address may not receive marketing. */
  private async sendTo(prospect: Prospect): Promise<string | null> {
    const token = createUnsubscribeToken(prospect.email, this.secret)
    await this.sender.ensureContact(prospect.email, token, prospect.gymName)
    if (!(await this.sender.canReceiveMarketing(prospect.email))) return null

    const url = new URL(`${SITE_URL}${UNSUBSCRIBE_PATH}`)
    url.searchParams.set('email', prospect.email)
    url.searchParams.set('token', token)
    url.searchParams.set('topic', MailingTopic.Marketing)
    const unsubscribeUrl = url.toString()

    return this.sender.send({
      to: prospect.email,
      ...introCampaignEmail({ unsubscribeUrl }),
      unsubscribeUrl,
      topicId: RESEND_TOPIC_IDS[MailingTopic.Marketing],
    })
  }
}
