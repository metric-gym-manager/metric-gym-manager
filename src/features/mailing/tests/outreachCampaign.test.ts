/**
 * @jest-environment node
 */
import {
  CONTACT,
  LEGAL_NAME,
  POSTAL_ADDRESS,
} from '@/features/marketing/config/site'
import {
  LITE_MEMBER_LIMIT,
  PRICING_TIERS,
  TRIAL_DAYS,
  formatLkr,
} from '@/features/marketing/config/pricing'
import {
  OUTREACH_FROM,
  WHATSAPP_DEMO_URL,
  introCampaignEmail,
} from '../config/outreachCampaign'

/**
 * The introduction email to gyms that have never heard of Metric Gym OS
 * (owner request, 2026-10-06). It echoes the SMS that brought in calls, and
 * every number in it comes from the configs the website uses, so the email
 * can never quote a price or a limit the product does not have.
 */
const UNSUBSCRIBE =
  'https://www.metricgymos.com/unsubscribe?email=owner@titan.lk&token=tok_1&topic=marketing'
const email = introCampaignEmail({ unsubscribeUrl: UNSUBSCRIBE })
const lite = PRICING_TIERS.find((t) => t.tier === 'lite')

describe('the introduction email', () => {
  it('leads with the question that brought in calls', () => {
    expect(email.subject).toBe('Tired of chasing payments?')
    expect(email.html).toContain('Tired of chasing payments?')
  })

  it('goes out from the outreach subdomain, never the customer one', () => {
    expect(OUTREACH_FROM).toBe('Metric Gym OS <hello@go.metricgymos.com>')
  })

  it('quotes the published starting price, member limit and trial', () => {
    expect(lite).toBeDefined()
    for (const part of [
      `Rs. ${formatLkr(lite?.monthlyPriceLkr ?? 0)}`,
      `Up to ${LITE_MEMBER_LIMIT} active members`,
      `${TRIAL_DAYS}&#8209;day`,
    ]) {
      expect(email.html).toContain(part)
    }
    expect(email.text).toContain(`Rs. ${formatLkr(lite?.monthlyPriceLkr ?? 0)}`)
  })

  it('opens WhatsApp with the demo request already typed, from the button and the number', () => {
    expect(WHATSAPP_DEMO_URL).toBe(
      `${CONTACT.whatsappUrl}?text=Hi%2C%20I'd%20like%20a%20free%20demo%20of%20Metric%20Gym%20OS`
    )
    const links = email.html.match(/href="[^"]*wa\.me[^"]*"/g) ?? []
    expect(links.length).toBe(2)
    expect(email.html).toContain('>070 437 9967</a>')
    expect(email.html).not.toContain('href="tel:')
    expect(email.text).toContain(WHATSAPP_DEMO_URL)
  })

  it('carries the recipient’s own unsubscribe link, escaped for HTML', () => {
    expect(email.html).toContain(`href="${UNSUBSCRIBE.replace(/&/g, '&amp;')}"`)
    expect(email.text).toContain(UNSUBSCRIBE)
  })

  it('says where the address came from, who is sending, and from where', () => {
    expect(email.html).toMatch(/public/i)
    expect(email.html).toContain(LEGAL_NAME)
    expect(email.html).toContain(POSTAL_ADDRESS.streetAddress)
    expect(email.text).toContain(LEGAL_NAME)
  })

  it('makes no claim the product cannot back', () => {
    // The homepage's own list (HomePage.test.tsx): Metric records payments,
    // it does not collect them.
    for (const claim of [
      /automated fee collection/i,
      /revenue collection/i,
      /check-in/i,
    ]) {
      expect(email.html).not.toMatch(claim)
      expect(email.text).not.toMatch(claim)
    }
  })

  it('labels the sample figures as an example', () => {
    expect(email.html).toMatch(/\(example\)/)
  })

  it('fits a phone: one 560 px column that shrinks', () => {
    expect(email.html).toContain('max-width:560px')
    for (const [, value] of email.html.matchAll(/\swidth="([^"]+)"/g)) {
      expect(value === '100%' || Number(value) <= 48).toBe(true)
    }
  })

  it('is finished: no placeholders left for anyone to fill', () => {
    expect(email.html).not.toMatch(/\{\{/)
    expect(email.text).not.toMatch(/\{\{/)
  })

  it('has a plain-text version a mail filter can read', () => {
    expect(email.text).not.toMatch(/<[a-z]/i)
    expect(email.text).toContain('Tired of chasing payments?')
  })
})
