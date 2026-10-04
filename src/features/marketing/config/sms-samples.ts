/**
 * SMS samples quoted on the public site — rendered, never typed.
 *
 * `/features/sms-reminders`, `/resources/membership-renewal-reminders` and
 * `/resources/move-gym-members-from-register-book` show members' texts. They
 * build them here from the product's own templates
 * (`features/sms/config/SmsTemplates.ts`), so a wording change reaches the
 * site in the same commit and no page can quote a message the product does
 * not send (rule 2.23).
 *
 * The example gym is `Your Gym`, an obvious placeholder: a real gym name here
 * would read as a customer claim (SEO-024).
 */

import { PlanType } from '@/features/members/config/PlanConfig'
import { ReminderType } from '@/features/sms/config/ReminderConfig'
import {
  receiptSms,
  reminderSms,
  welcomeSms,
} from '@/features/sms/config/SmsTemplates'

/** The example member every sample is addressed to. */
export const SMS_SAMPLE = {
  gymName: 'Your Gym',
  memberName: 'Nimal',
  planType: PlanType.Monthly,
  amount: 4000,
  /** The due date the reminders quote (local, as the product formats it). */
  dueDate: new Date(2026, 10, 15),
  /** The next due date a receipt quotes after paying on time. */
  nextDueDate: new Date(2026, 11, 15),
} as const

const party = { gymName: SMS_SAMPLE.gymName, memberName: SMS_SAMPLE.memberName }

function reminder(type: ReminderType): string {
  return reminderSms(type, {
    ...party,
    planType: SMS_SAMPLE.planType,
    amount: SMS_SAMPLE.amount,
    dueDate: SMS_SAMPLE.dueDate,
  })
}

/** The 7- and 3-day reminders (both carry the same text). */
export const SAMPLE_REMINDER_BEFORE_DUE = reminder(ReminderType.SevenDay)

/** The due-date reminder — the member's last day before expiry. */
export const SAMPLE_REMINDER_DUE_TODAY = reminder(ReminderType.DueToday)

/** The receipt sent when a payment is recorded. */
export const SAMPLE_RECEIPT = receiptSms({
  ...party,
  amountPaid: SMS_SAMPLE.amount,
  nextDueDate: SMS_SAMPLE.nextDueDate,
})

/**
 * The welcome text for the example member.
 *
 * @param nextDueDate - The member's first due date, computed by the page from
 *   its own worked example
 * @returns The text a newly registered member receives
 */
export function sampleWelcomeSms(nextDueDate: Date): string {
  return welcomeSms({
    ...party,
    planType: SMS_SAMPLE.planType,
    amountPaid: SMS_SAMPLE.amount,
    nextDueDate,
  })
}
