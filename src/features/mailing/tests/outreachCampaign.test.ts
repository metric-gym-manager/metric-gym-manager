/**
 * @jest-environment node
 */
import {
  CONTACT,
  LEGAL_NAME,
  POSTAL_ADDRESS,
  SITE_URL,
} from '@/features/marketing/config/site'
import {
  LITE_MEMBER_LIMIT,
  TRIAL_DAYS,
  formatLkr,
  lowestMonthlyPriceLkr,
} from '@/features/marketing/config/pricing'
import {
  OUTREACH_FROM,
  OUTREACH_SEQUENCE_LENGTH,
  WHATSAPP_DEMO_URL,
  outreachEmail,
  type OutreachStep,
} from '../config/outreachCampaign'

/**
 * The four introduction emails, one a week, to gyms that have never heard of
 * Metric Gym OS (owner request, 2026-10-06). Every number comes from the
 * configs the website uses, every claim is one the product backs, and every
 * email — not just the first — carries the recipient's own unsubscribe link.
 */
const UNSUBSCRIBE =
  'https://www.metricgymos.com/unsubscribe?email=owner%40titan.lk&token=tok_1&topic=marketing'
const STEPS: OutreachStep[] = [1, 2, 3, 4]
const email = (step: OutreachStep) =>
  outreachEmail(step, { unsubscribeUrl: UNSUBSCRIBE })

it('is a series of four, one a week', () => {
  expect(OUTREACH_SEQUENCE_LENGTH).toBe(4)
  expect(new Set(STEPS.map((s) => email(s).subject)).size).toBe(4)
})

it('goes out from the outreach subdomain, never the customer one', () => {
  expect(OUTREACH_FROM).toBe('Metric Gym OS <hello@go.metricgymos.com>')
})

describe.each(STEPS)('email %i', (step) => {
  const { subject, html, text } = email(step)

  it('carries the recipient’s own unsubscribe link, in the HTML and the text', () => {
    expect(html).toContain(`href="${UNSUBSCRIBE.replace(/&/g, '&amp;')}"`)
    expect(html).toMatch(/>Unsubscribe<\/a>/)
    expect(text).toContain(UNSUBSCRIBE)
  })

  it('says where the address came from, and which email of four this is', () => {
    expect(html).toMatch(/public page/i)
    expect(html).toContain(`email ${step} of 4`)
    expect(text).toContain(`email ${step} of 4`)
  })

  it('names the sender and its postal address', () => {
    expect(html).toContain(LEGAL_NAME)
    expect(html).toContain(POSTAL_ADDRESS.streetAddress)
    expect(text).toContain(LEGAL_NAME)
  })

  it('opens WhatsApp with the demo request typed, and never a plain phone link', () => {
    expect(WHATSAPP_DEMO_URL).toBe(
      `${CONTACT.whatsappUrl}?text=Hi%2C%20I'd%20like%20a%20free%20demo%20of%20Metric%20Gym%20OS`
    )
    // The number never breaks across lines on a phone (emailFrame `keep`).
    const number =
      '<span class="m-keep" style="white-space:nowrap">070 437 9967</span>'
    // The number itself opens the chat, in every email.
    expect(html).toMatch(
      new RegExp(
        `<a href="https://wa\\.me/94704379967\\?text=[^"]+"[^>]*white-space:nowrap[^>]*>${number}</a>`
      )
    )
    expect(html).not.toContain('href="tel:')
    expect(text).toContain(WHATSAPP_DEMO_URL)
  })

  it('quotes the published starting price, member limit and trial', () => {
    expect(html).toContain(`Rs. ${formatLkr(lowestMonthlyPriceLkr())}`)
    expect(html).toContain(`Up to ${LITE_MEMBER_LIMIT} active members`)
    expect(html).toContain(`${TRIAL_DAYS}&#8209;day`)
  })

  it('makes no claim the product cannot back', () => {
    for (const claim of [
      /automated fee collection/i,
      /revenue collection/i,
      /collects? (the )?(fees|payments|money) for you/i,
      /check-in/i,
      /whatsapp (reminders|messages to members)/i,
      /7 days before every/i,
    ]) {
      expect(html).not.toMatch(claim)
      expect(text).not.toMatch(claim)
    }
  })

  it('labels any sample figures as an example', () => {
    if (
      /Rs\. \d{2,3},\d{3}/.test(
        html.replace(`Rs. ${formatLkr(lowestMonthlyPriceLkr())}`, '')
      )
    ) {
      expect(html).toMatch(/\(example\)/)
    }
  })

  it('fits a phone: one 560 px column that shrinks', () => {
    expect(html).toContain('max-width:560px')
    for (const [, value] of html.matchAll(/\swidth="([^"]+)"/g)) {
      expect(value === '100%' || Number(value) <= 48).toBe(true)
    }
  })

  it('is finished: no placeholders, and a plain-text part a filter can read', () => {
    expect(`${subject}${html}${text}`).not.toMatch(/\{\{/)
    expect(text).not.toMatch(/<[a-z]/i)
    expect(text.startsWith(subject)).toBe(true)
  })
})

describe('the four, in order', () => {
  it('1 asks the question that brought in calls', () => {
    expect(email(1).subject).toBe('Tired of chasing payments?')
  })

  it('2 is about the reminders, as the product sends them', () => {
    const { subject, html } = email(2)
    expect(subject).toMatch(/reminders/i)
    // Monthly members: 3 days before and on the due day; overdue once missed.
    expect(html).toMatch(/3 days before/)
    // Short titles tie their last two words (`noOrphan`).
    expect(html.replace(/&nbsp;/g, ' ')).toMatch(/On the due day/)
    expect(html).toMatch(/receipt/i)
  })

  it('3 is about what is owed against what was collected', () => {
    const { html } = email(3)
    expect(html).toMatch(/owe/i)
    expect(html).toMatch(/collected/i)
  })

  it('4 is about getting started, links to sign-up, and says it is the last', () => {
    const { html, text } = email(4)
    expect(html).toContain(`href="${SITE_URL}/register"`)
    expect(html).toMatch(/QR/)
    expect(html).toMatch(/last email/i)
    expect(text).toMatch(/last email/i)
  })
})
