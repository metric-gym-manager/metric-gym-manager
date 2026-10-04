/**
 * The manual send (`POST /api/sms/send`, Payment Collection's "Send reminder")
 * accepts only the message types it can word on its own. A receipt needs the
 * payment's details and an announcement is written by the gym, so neither can
 * be sent from a member id alone — a receipt request used to send an empty
 * body.
 */

import { sendSMSSchema } from '../schemas/sms.schemas'
import { ReminderType } from '../config/ReminderConfig'

const MEMBER_ID = '11111111-1111-4111-8111-111111111111'

describe('sendSMSSchema', () => {
  it.each([...Object.values(ReminderType), 'welcome', 'reactivation'])(
    'accepts %s',
    (smsType) => {
      expect(
        sendSMSSchema.safeParse({ memberId: MEMBER_ID, smsType }).success
      ).toBe(true)
    }
  )

  it.each(['receipt', 'announcement', 'promo'])('rejects %s', (smsType) => {
    expect(
      sendSMSSchema.safeParse({ memberId: MEMBER_ID, smsType }).success
    ).toBe(false)
  })
})
