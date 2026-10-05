/**
 * @jest-environment node
 */
import { SITE_URL } from '@/features/marketing/config/site'
import {
  MailingTopic,
  RESEND_TOPIC_IDS,
  UNSUBSCRIBE_PATH,
  unsubscribeLinkTemplate,
} from '../config/MailingConfig'
import { deliveredMailingEmail } from '../utils/unsubscribeToken'

/**
 * The footer link every broadcast carries. F11 (inverted check, 2026-10-06):
 * it had no test, and a wrong placeholder here breaks every link in a send.
 */
describe('unsubscribeLinkTemplate', () => {
  /** What Resend does: substitute stored values, unencoded. */
  function fill(template: string, email: string, token: string): string {
    return template
      .replace('{{{contact.email}}}', email)
      .replace('{{{contact.unsubscribe_token}}}', token)
  }

  it.each(Object.values(MailingTopic))(
    'points %s links at the canonical /unsubscribe with the stored fields',
    (topic) => {
      const template = unsubscribeLinkTemplate(topic)
      expect(template.startsWith(`${SITE_URL}${UNSUBSCRIBE_PATH}?`)).toBe(true)
      expect(template).toContain('email={{{contact.email}}}')
      expect(template).toContain('token={{{contact.unsubscribe_token}}}')
      expect(template).toContain(`topic=${topic}`)
    }
  )

  it('survives a + in the address once the page restores it', () => {
    const url = new URL(
      fill(
        unsubscribeLinkTemplate(MailingTopic.Marketing),
        'Owner+Gym@Titan.lk',
        'tok_A-1'
      )
    )
    // URLSearchParams decodes the unencoded + as a space…
    expect(url.searchParams.get('email')).toBe('Owner Gym@Titan.lk')
    // …which the page and the API turn back, keeping the stored case.
    expect(deliveredMailingEmail(url.searchParams.get('email') ?? '')).toBe(
      'Owner+Gym@Titan.lk'
    )
    expect(url.searchParams.get('token')).toBe('tok_A-1')
    expect(url.searchParams.get('topic')).toBe('marketing')
  })

  it('has a Resend topic id for every kind of email', () => {
    for (const topic of Object.values(MailingTopic)) {
      expect(RESEND_TOPIC_IDS[topic]).toMatch(/^[0-9a-f-]{36}$/)
    }
  })
})
