import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { SmsType } from '@/features/sms/config/SmsConfig'
import { SMS_TYPES } from '@/features/sms/config/SmsConfig'
import { ALWAYS_SENT_EMAILS } from '@/features/mailing/config/MailingConfig'
import PrivacyPolicyPage from '../page'

/**
 * The privacy policy's SMS section must describe the texts the product sends
 * (rule 2.23). It said every SMS "includes information on how to stop
 * receiving it" — no template ever did, and the owner decided on 2026-10-04
 * that the texts are a necessary part of the product and will not carry
 * opt-out wording. It also said the texts were "limited to" reminders,
 * renewal notices and expiry alerts, leaving out the welcome text, receipts
 * and the gym's announcements.
 *
 * Typed `Record<SmsType, …>`: a new kind of SMS fails type-checking here until
 * the policy is given a line for it.
 */
const POLICY_LINE: Record<SmsType, RegExp> = {
  welcome: /A welcome message when a member is registered/,
  reactivation: /or returns after a cancellation or suspension/,
  receipt: /Payment receipts, with the next due date/,
  reminder_7day: /Payment due reminders/,
  reminder_3day: /Payment due reminders/,
  due_today: /Payment due reminders/,
  overdue: /Expiry alerts/,
  announcement: /Announcements the gym sends to its own members/,
}

describe('privacy policy — SMS communications', () => {
  const text = () => render(<PrivacyPolicyPage />).container.textContent ?? ''

  it.each(SMS_TYPES)('names the %s text', (type) => {
    expect(text()).toMatch(POLICY_LINE[type])
  })

  it('does not claim the texts carry opt-out instructions', () => {
    expect(text()).not.toMatch(/how to stop receiving it/i)
  })
})

/**
 * Email communications (owner decision, 2026-10-06): two kinds of email, each
 * stoppable on its own from /unsubscribe, and a fixed list of emails that keep
 * arriving. The list is imported from the config the /unsubscribe page shows,
 * so the page and the policy cannot drift apart.
 */
describe('privacy policy — email communications', () => {
  const text = () => render(<PrivacyPolicyPage />).container.textContent ?? ''

  it('names both kinds of email', () => {
    expect(text()).toMatch(/marketing emails/i)
    expect(text()).toMatch(/product and security updates/i)
  })

  it('says each kind can be stopped separately', () => {
    expect(text()).toMatch(/stop either kind, or both/i)
  })

  it('emails demo-request visitors only with their consent', () => {
    expect(text()).toMatch(/only if you ticked the box/i)
  })

  it('says policy-change notices reach every current gym whatever it chose, except through the mail app button', () => {
    const t = text()
    expect(t).toMatch(
      /material change to our Terms of Service, Privacy Policy or Refund Policy/
    )
    expect(t).toMatch(/whatever email choices you have made/i)
    expect(t).toMatch(
      /unsubscribe button your email app shows stops these notices too/i
    )
  })

  it('promises an emailed summary of material changes, not a maybe', () => {
    const t = text()
    expect(t).toMatch(
      /email a summary of the changes to every gym owner with a current subscription/i
    )
    expect(t).not.toMatch(/where appropriate, notify you/i)
  })

  it.each([...ALWAYS_SENT_EMAILS])(
    'lists "%s" among the emails that keep arriving',
    (line) => {
      expect(text()).toContain(line)
    }
  )

  it('points the rights section at the Contact Us section by its real number', () => {
    const { container } = render(<PrivacyPolicyPage />)
    const headings = Array.from(container.querySelectorAll('.legal-sec')).map(
      (section) => section.textContent ?? ''
    )
    const contact = headings.findIndex((h) => /^\d+\.\s*Contact Us/.test(h))
    expect(contact).toBeGreaterThan(-1)
    expect(container.textContent).toContain(
      `contact details in Section ${contact + 1}`
    )
  })

  it('points the uses section at Email Communications by its real number', () => {
    const { container } = render(<PrivacyPolicyPage />)
    const headings = Array.from(container.querySelectorAll('.legal-sec')).map(
      (section) => section.textContent ?? ''
    )
    const email = headings.findIndex((h) =>
      /^\d+\.\s*Email Communications/.test(h)
    )
    expect(email).toBeGreaterThan(-1)
    expect(container.textContent).toContain(
      `stop either kind at any time (Section ${email + 1})`
    )
  })
})

/**
 * Inverted check, 2026-10-06. F6: §3 and §5 said demo-request visitors are
 * emailed, while §2 never said their details are collected at all. F7: the
 * policy said email data is deleted when an account closes, and nothing in
 * the product does that.
 */
describe('privacy policy — demo requests and mailing-list retention', () => {
  const text = () => render(<PrivacyPolicyPage />).container.textContent ?? ''

  it('says what the demo request form collects, including the consent record', () => {
    const t = text()
    expect(t).toMatch(/Information We Collect from People Who Request a Demo/)
    expect(t).toMatch(/name, email address and phone number/i)
    expect(t).toMatch(/tick the box\s+asking for marketing emails/i)
    expect(t).toMatch(/record when you ticked it/i)
  })

  it('does not promise deletion on account closure that nothing performs', () => {
    expect(text()).not.toMatch(/delete them or\s+close your account/)
    expect(text()).toMatch(/until you ask us to delete them/)
  })
})

/**
 * Owner decisions of 2026-10-06: product and security updates go to current
 * subscriptions, cancelled and suspended gyms get marketing only, and an
 * email change moves the person's choices to the new address.
 */
describe('privacy policy — who gets which email', () => {
  const text = () => render(<PrivacyPolicyPage />).container.textContent ?? ''

  it('sends updates to current subscriptions only', () => {
    expect(text()).toMatch(/current subscription/i)
  })

  it('says a cancelled or suspended gym receives marketing emails only', () => {
    expect(text()).toMatch(
      /cancelled or suspended gym receives marketing emails only/i
    )
  })

  it('says choices move with an email change and the old address is deleted', () => {
    expect(text()).toMatch(/change your account's email address/i)
    expect(text()).toMatch(/delete the old one/i)
  })
})

/**
 * Measured 2026-10-06: Gmail's own unsubscribe button (the List-Unsubscribe
 * one-click Resend adds to every broadcast) sets Resend's account-wide flag,
 * which stops BOTH kinds of email. The policy must not promise that stopping
 * one kind never stops the other without saying which control does what.
 */
describe('privacy policy — the mail app unsubscribe button', () => {
  it("says the mail app's own unsubscribe button stops both kinds", () => {
    const text = render(<PrivacyPolicyPage />).container.textContent ?? ''
    expect(text).toMatch(/unsubscribe button your email app shows/i)
    expect(text).toMatch(/stops both kinds/i)
  })
})
