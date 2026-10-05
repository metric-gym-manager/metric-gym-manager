import { SmtpLeadNotifier } from '../services/SmtpLeadNotifier'
import {
  LeadInterest,
  LEAD_NOTIFY_FROM,
  LEAD_NOTIFY_TO,
} from '../config/LeadConfig'
import type { Lead } from '../types'
import type { Mailer, MailMessage } from '@/lib/email/smtp'

/**
 * The email a demo request sends to hello@metricgymos.com. It is read by a
 * person deciding whom to call, so it carries every field the visitor typed,
 * and replying to it must reach the visitor, not the no-reply sender.
 */
function capture(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = []
  return {
    sent,
    send: async (message) => {
      sent.push(message)
    },
  }
}

const lead: Lead = {
  id: '6f1c2c1e-0000-4000-8000-000000000001',
  name: 'Nimal Perera',
  email: 'nimal@example.lk',
  phone: '+94 77 123 4567',
  gymName: 'Titan Fitness',
  message: 'Do you support fingerprint readers?',
  interest: LeadInterest.Lite,
  source: 'landing',
  createdAt: '2026-10-05T06:34:14.534Z',
}

describe('SmtpLeadNotifier', () => {
  it('sends from the no-reply address to hello@, replying to the visitor', async () => {
    const mailer = capture()
    await new SmtpLeadNotifier(mailer).notify(lead)

    const [m] = mailer.sent
    expect(LEAD_NOTIFY_TO).toBe('hello@metricgymos.com')
    expect(LEAD_NOTIFY_FROM).toBe('Metric Gym OS <noreply@metricgymos.com>')
    expect(m.to).toBe(LEAD_NOTIFY_TO)
    expect(m.from).toBe(LEAD_NOTIFY_FROM)
    expect(m.replyTo).toBe('nimal@example.lk')
    expect(m.subject).toBe('Demo request: Nimal Perera (Titan Fitness)')
  })

  it('carries every field, the plan label and the Sri Lanka time', async () => {
    const mailer = capture()
    await new SmtpLeadNotifier(mailer).notify(lead)
    const { text } = mailer.sent[0]

    for (const value of [
      'Nimal Perera',
      'nimal@example.lk',
      '+94 77 123 4567',
      'Titan Fitness',
      'Lite plan',
      'Do you support fingerprint readers?',
      lead.id,
    ]) {
      expect(text).toContain(value)
    }
    // 06:34 UTC is 12:04 in Sri Lanka (UTC+05:30).
    expect(text).toMatch(/5 Oct 2026, 12:04/)
  })

  it('marks missing optional fields and keeps non-English names intact', async () => {
    const mailer = capture()
    await new SmtpLeadNotifier(mailer).notify({
      ...lead,
      name: 'නිමල් පෙරේරා',
      gymName: null,
      message: null,
    })
    const [m] = mailer.sent
    expect(m.subject).toBe('Demo request: නිමල් පෙරේරා')
    expect(m.text).toMatch(/Gym:\s+—/)
    expect(m.text).toMatch(/Message:\s+—/)
  })

  it('cannot be steered into extra headers by a name with line breaks', async () => {
    const mailer = capture()
    await new SmtpLeadNotifier(mailer).notify({
      ...lead,
      name: 'Nimal\r\nBcc: someone@example.com',
      gymName: null,
    })
    expect(mailer.sent[0].subject).not.toMatch(/[\r\n]/)
  })
})
