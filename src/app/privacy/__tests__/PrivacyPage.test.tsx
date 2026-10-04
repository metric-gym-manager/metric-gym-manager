import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { SmsType } from '@/features/sms/config/SmsConfig'
import { SMS_TYPES } from '@/features/sms/config/SmsConfig'
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
