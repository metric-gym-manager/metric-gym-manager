/**
 * @jest-environment node
 */
import { SITE_URL } from '@/features/marketing/config/site'
import {
  ALWAYS_SENT_EMAILS,
  MailingAudience,
  MailingTopic,
  RESEND_SEGMENT_IDS,
  RESEND_TEST_SEGMENT_ID,
  RESEND_TOPIC_IDS,
  UNSUBSCRIBE_PATH,
  preferencesLinkTemplate,
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

/**
 * Policy notices go to every current gym whatever its topic choices (owner
 * decision, 2026-10-06), so their footer opens the preferences page with no
 * topic pre-selected: a "stop these" link would promise what it cannot do.
 */
describe('preferencesLinkTemplate', () => {
  it('opens /unsubscribe with the stored fields and no topic', () => {
    const template = preferencesLinkTemplate()
    expect(template).toBe(
      `${SITE_URL}${UNSUBSCRIBE_PATH}` +
        '?email={{{contact.email}}}&token={{{contact.unsubscribe_token}}}'
    )
    expect(template).not.toContain('topic=')
  })

  it('is the unsubscribe link without its topic', () => {
    expect(unsubscribeLinkTemplate(MailingTopic.Updates)).toBe(
      `${preferencesLinkTemplate()}&topic=updates`
    )
  })
})

describe('RESEND_TEST_SEGMENT_ID', () => {
  it('is a segment id and never one a real send targets', () => {
    expect(RESEND_TEST_SEGMENT_ID).toMatch(/^[0-9a-f-]{36}$/)
    for (const audience of Object.values(MailingAudience)) {
      expect(RESEND_SEGMENT_IDS[audience]).not.toBe(RESEND_TEST_SEGMENT_ID)
    }
  })
})

/**
 * Policy-change notices go to every gym with a current subscription, whatever
 * it chose (owner decision, 2026-10-06). /unsubscribe and the privacy policy
 * both print this list, so saying it here is saying it to the person.
 */
describe('ALWAYS_SENT_EMAILS', () => {
  it('names notices of changes to the terms, privacy and refund policies', () => {
    expect(ALWAYS_SENT_EMAILS).toContain(
      'Notices of changes to our Terms of Service, Privacy Policy or Refund Policy'
    )
  })
})
