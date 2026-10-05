import type { Mailer } from '@/lib/email/smtp'
import {
  LEAD_NOTIFY_FROM,
  LEAD_NOTIFY_TO,
  getLeadInterestLabel,
} from '../config/LeadConfig'
import type { Lead } from '../types'
import type { ILeadNotifier } from './ILeadNotifier'

const RECEIVED = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** A header value on one line: a visitor's text must not add headers. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/**
 * Emails each demo request to hello@metricgymos.com (owner decision,
 * 2026-10-05). Replying to the email reaches the visitor: Reply-To is their
 * address, the sender is the no-reply alias.
 */
export class SmtpLeadNotifier implements ILeadNotifier {
  constructor(private readonly mailer: Mailer) {}

  async notify(lead: Lead): Promise<void> {
    const name = oneLine(lead.name)
    const gym = lead.gymName ? oneLine(lead.gymName) : null
    const subject = `Demo request: ${name}${gym ? ` (${gym})` : ''}`.slice(
      0,
      150
    )

    const text = [
      'New demo request from the Metric Gym OS website.',
      '',
      `Name:      ${lead.name}`,
      `Email:     ${lead.email}`,
      `Phone:     ${lead.phone}`,
      `Gym:       ${lead.gymName ?? '—'}`,
      `Plan:      ${getLeadInterestLabel(lead.interest)}`,
      `Message:   ${lead.message ?? '—'}`,
      '',
      `Received:  ${RECEIVED.format(new Date(lead.createdAt))} (Sri Lanka time)`,
      `Lead id:   ${lead.id}`,
      '',
      `Reply to this email to answer ${name} directly.`,
    ].join('\n')

    await this.mailer.send({
      from: LEAD_NOTIFY_FROM,
      to: LEAD_NOTIFY_TO,
      replyTo: lead.email,
      subject,
      text,
    })
  }
}
