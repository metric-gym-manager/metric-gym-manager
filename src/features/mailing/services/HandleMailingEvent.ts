import { MailingTopic, RESEND_TOPIC_IDS } from '../config/MailingConfig'
import {
  OUTREACH_DOMAIN,
  OUTREACH_UNSUBSCRIBE_ADDRESS,
} from '../config/outreachCampaign'
import type { ResendWebhookEvent } from '../schemas/mailingEvents.schemas'
import { emailAddressOf } from '../utils/emailAddress'
import type { IMailingList } from './IMailingList'
import type {
  IOutreachLedger,
  OutreachStop,
  StopOptions,
} from './IOutreachLedger'
import type { IOwnerMailer } from './IOwnerMailer'
import type { OutreachBrake } from './OutreachBrake'

export type MailingEventResult =
  | {
      outcome: 'stopped'
      status: OutreachStop
      /** Campaigns whose row changed; empty for a repeat delivery. */
      campaigns: string[]
      /** Campaigns this event paused. */
      paused: string[]
    }
  | { outcome: 'unsubscribed'; campaigns: string[] }
  | { outcome: 'forwarded'; forwardedId: string }
  | { outcome: 'ignored'; reason: string }

const ignored = (reason: string): MailingEventResult => ({
  outcome: 'ignored',
  reason,
})

/** Outreach is everything sent from its own domain, and nothing else. */
function isOutreach(from: string): boolean {
  return emailAddressOf(from)?.endsWith(`@${OUTREACH_DOMAIN}`) ?? false
}

/**
 * What Resend's webhook tells the mailing feature, acted on (owner request,
 * 2026-10-06 — the two owner tasks of the outreach series, automated):
 *
 * - a hard bounce, spam complaint or suppressed send of an OUTREACH email
 *   ends the series for that address (`bounced` / `complained`), and a
 *   complaint opts it out of Marketing; the safety brake is then checked;
 * - an email to `OUTREACH_UNSUBSCRIBE_ADDRESS` (a mail app's unsubscribe by
 *   email) opts its sender out of Marketing and ends their series;
 * - a Marketing opt-out made anywhere (the footer link, a mail app's
 *   one-click) ends the series at once, not on the next due send;
 * - any other email to the outreach domain is passed to the owner.
 *
 * Every step is safe to repeat: Resend delivers webhooks at least once, the
 * ledger records an event only when a status actually changes, an opt-out of
 * an opted-out address changes nothing, and a forward carries an idempotency
 * key. The ledger is written BEFORE Resend is told: an opt-out fires Resend's
 * own `contact.topics.updated`, which must find the status already set, and a
 * failed opt-out (retried by Resend) must not lose the record.
 */
export class HandleMailingEvent {
  constructor(
    private readonly ledger: IOutreachLedger,
    private readonly list: IMailingList,
    private readonly owner: IOwnerMailer,
    private readonly brake: OutreachBrake,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async execute(event: ResendWebhookEvent): Promise<MailingEventResult> {
    switch (event.type) {
      case 'email.bounced': {
        if (!isOutreach(event.data.from)) return ignored('not outreach')
        // Only a Permanent bounce means the address is gone; Resend retries
        // a Transient one, and an Undetermined one proves nothing.
        if (event.data.bounce.type !== 'Permanent') {
          return ignored(`${event.data.bounce.type} bounce`)
        }
        return this.stopRecipients(event.data.to, 'bounced', {
          detail: event.data.bounce.message,
        })
      }
      case 'email.complained': {
        if (!isOutreach(event.data.from)) return ignored('not outreach')
        // The ledger first: the opt-out makes Resend send its own
        // contact.topics.updated, which must find the complaint already
        // recorded (or it would also count as an unsubscribe).
        const result = await this.stopRecipients(
          event.data.to,
          'complained',
          {}
        )
        for (const email of addresses(event.data.to)) {
          await this.list.optOut(email, [MailingTopic.Marketing])
        }
        return result
      }
      case 'email.suppressed': {
        if (!isOutreach(event.data.from)) return ignored('not outreach')
        // Resend sends `type: "Suppressed"` every time; the cause is `reason`.
        const { reason, type } = event.data.suppressed
        const status = /complain/i.test(`${reason ?? ''} ${type}`)
          ? 'complained'
          : 'bounced'
        return this.stopRecipients(event.data.to, status, {
          event: 'suppressed',
          detail: event.data.suppressed.message,
        })
      }
      case 'email.received': {
        const recipients = addresses([
          ...event.data.to,
          ...(event.data.cc ?? []),
          ...(event.data.received_for ?? []),
        ])
        if (!recipients.includes(OUTREACH_UNSUBSCRIBE_ADDRESS)) {
          return {
            outcome: 'forwarded',
            forwardedId: await this.owner.forward(event.data.email_id),
          }
        }
        const sender = emailAddressOf(event.data.from)
        if (!sender) return ignored('unsubscribe email with no sender address')
        // The ledger first, as for a complaint.
        const campaigns = await this.ledger.stop(sender, 'unsubscribed', {
          detail: 'unsubscribed by email',
        })
        await this.list.optOut(sender, [MailingTopic.Marketing])
        return { outcome: 'unsubscribed', campaigns }
      }
      case 'contact.topics.updated': {
        const optedOut = event.data.topics.some(
          (topic) =>
            topic.id === RESEND_TOPIC_IDS[MailingTopic.Marketing] &&
            topic.subscription === 'opt_out'
        )
        const email = emailAddressOf(event.data.email)
        if (!optedOut || !email) return ignored('not a Marketing opt-out')
        return {
          outcome: 'unsubscribed',
          campaigns: await this.ledger.stop(email, 'unsubscribed'),
        }
      }
    }
  }

  private async stopRecipients(
    to: string[],
    status: OutreachStop,
    options: StopOptions
  ): Promise<MailingEventResult> {
    const campaigns = new Set<string>()
    for (const email of addresses(to)) {
      for (const campaign of await this.ledger.stop(email, status, options)) {
        campaigns.add(campaign)
      }
    }
    const paused: string[] = []
    // A suppressed send is not a new bounce, so it cannot trip the brake.
    if (options.event !== 'suppressed') {
      for (const campaign of campaigns) {
        if ((await this.brake.check(campaign, this.clock())).paused) {
          paused.push(campaign)
        }
      }
    }
    return { outcome: 'stopped', status, campaigns: [...campaigns], paused }
  }
}

function addresses(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map(emailAddressOf)
        .filter((email): email is string => email !== null)
    ),
  ]
}
