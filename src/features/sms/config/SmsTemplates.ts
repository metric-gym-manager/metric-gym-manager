/**
 * SMS templates — the single wording authority for every automated member text.
 *
 * Welcome, welcome back, receipt, the four reminders and the day-pass receipt
 * are all built here and nowhere else. The use cases call these builders, and
 * the public marketing pages render their sample texts from them too, so the
 * site can never quote a message the product does not send (rule 2.23).
 *
 * Three rules hold for every template, each pinned by `SmsTemplates.test.ts`:
 *
 * 1. **It names the gym** (SEO-053). The sender ID is one platform-wide value
 *    (`TEXT_LK_SENDER_ID`), so the text is the only place a member learns
 *    which gym is writing to them.
 * 2. **It is GSM-7.** One em dash, curly quote or emoji switches the whole
 *    message to UCS-2: 70 characters a segment instead of 160, which multiplies
 *    the cost of every text. Interpolated names are straightened on the way
 *    in. A Sinhala or Tamil name still forces UCS-2 — expected, not blocked.
 * 3. **It fits its segment budget.** The gym name is capped at
 *    {@link SMS_GYM_NAME_MAX} so a long name cannot push a reminder to a third
 *    segment. Budgets were agreed with the owner on 2026-10-03.
 *
 * Pure functions only — no Supabase, no `next/*` — because marketing pages
 * deep-import this file (the `@/features/sms` barrel is server-tainted).
 */

import { PLAN_CONFIGS, PlanType } from '@/features/members/config/PlanConfig'
import { formatDateForDisplay } from '@/utils/date/date'
import { ReminderType } from './ReminderConfig'

/** Longest gym name an SMS carries; longer names are cut, not ellipsised. */
export const SMS_GYM_NAME_MAX = 30

/** Longest discount name a receipt carries. */
export const SMS_DISCOUNT_NAME_MAX = 20

// ============================================================
// GSM-7
// ============================================================

/** GSM 03.38 basic character table (one septet each), minus the escape. */
const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
    '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
)

/** GSM 03.38 extension table — each costs an escape plus itself (two septets). */
const GSM7_EXTENSION = new Set('\f^{}\\[~]|€')

/**
 * Whether a text can travel as GSM-7.
 *
 * @param text - The message body
 * @returns True when every character is in the GSM-7 basic or extension table
 */
export function isGsm7(text: string): boolean {
  for (const char of text) {
    if (!GSM7_BASIC.has(char) && !GSM7_EXTENSION.has(char)) return false
  }
  return true
}

/**
 * How many SMS segments a text is billed as.
 *
 * GSM-7: 160 septets in one segment, 153 per segment once split (extension
 * characters count two). Anything else is UCS-2: 70 code units, then 67.
 *
 * @param text - The message body
 * @returns The segment count (0 for an empty text)
 * @example
 * smsSegmentCount('a'.repeat(160)) // 1
 * smsSegmentCount('a'.repeat(161)) // 2
 */
export function smsSegmentCount(text: string): number {
  if (text.length === 0) return 0

  if (isGsm7(text)) {
    let septets = 0
    for (const char of text) septets += GSM7_EXTENSION.has(char) ? 2 : 1
    return septets <= 160 ? 1 : Math.ceil(septets / 153)
  }

  return text.length <= 70 ? 1 : Math.ceil(text.length / 67)
}

// ============================================================
// VALUE FORMATTING
// ============================================================

/**
 * Straighten typography that would force UCS-2, and normalise whitespace.
 * Names typed on a phone or pasted from a spreadsheet carry curly quotes.
 */
function cleanSmsText(raw: string): string {
  return raw
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Clean a value and cut it to `max` characters, never ending on a space. */
function capped(raw: string, max: number): string {
  return cleanSmsText(raw).slice(0, max).trimEnd()
}

/**
 * The gym name as an SMS prints it: cleaned and capped.
 *
 * @param raw - `gyms.gym_name` as stored (may carry stray spaces)
 * @returns At most {@link SMS_GYM_NAME_MAX} GSM-safe characters
 */
export function smsGymName(raw: string): string {
  return capped(raw, SMS_GYM_NAME_MAX)
}

/**
 * Rupees as an SMS prints them: thousands separated, cents only when present.
 *
 * @param amount - Amount in LKR
 * @returns e.g. `Rs.4,000`, `Rs.2,975.50`
 */
export function smsAmount(amount: number): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const sign = amount < 0 ? '-' : ''
  return `Rs.${sign}${grouped}${cents === '00' ? '' : `.${cents}`}`
}

/**
 * "monthly membership", "3-month membership" — or plain "membership" for a
 * custom plan (and any value the plan table does not know), derived from the
 * plan labels in `PLAN_CONFIGS` so no plan name is spelled twice.
 */
function membership(planType: PlanType | string): string {
  if (planType === PlanType.Custom) return 'membership'
  const label = PLAN_CONFIGS[planType as PlanType]?.label
  if (!label) return 'membership'
  return `${label.replace(/ Plan$/, '').toLowerCase()} membership`
}

// ============================================================
// TEMPLATES
// ============================================================

/** Fields every template interpolates. */
interface SmsParty {
  /** `gyms.gym_name` — cleaned and capped here, so pass it raw. */
  gymName: string
  memberName: string
}

/**
 * Registration welcome. Deliberately two segments: it goes out once per
 * member, and the owner chose the warmer wording over the shorter one.
 *
 * @returns The welcome text
 */
export function welcomeSms(
  p: SmsParty & {
    planType: PlanType | string
    amountPaid: number
    nextDueDate: Date
  }
): string {
  return (
    `Welcome to ${smsGymName(p.gymName)}, ${cleanSmsText(p.memberName)}! ` +
    `Your ${membership(p.planType)} is active and we can't wait to see you training. ` +
    `Paid ${smsAmount(p.amountPaid)}. Next due ${formatDateForDisplay(p.nextDueDate)}. ` +
    `Have a great time!`
  )
}

/**
 * Reactivation (a suspended or cancelled member paying to come back).
 *
 * @returns The welcome-back text
 */
export function welcomeBackSms(
  p: SmsParty & {
    amountPaid: number
    nextDueDate: Date
  }
): string {
  return (
    `Welcome back to ${smsGymName(p.gymName)}, ${cleanSmsText(p.memberName)}! ` +
    `Great to have you training again. ` +
    `Paid ${smsAmount(p.amountPaid)}. Next due ${formatDateForDisplay(p.nextDueDate)}.`
  )
}

/**
 * Payment receipt, with the discount named when one applied.
 *
 * @returns The receipt text
 */
export function receiptSms(
  p: SmsParty & {
    amountPaid: number
    nextDueDate: Date
    discount?: { name: string; percentage: number } | null
  }
): string {
  const discount = p.discount
    ? ` (${capped(p.discount.name, SMS_DISCOUNT_NAME_MAX)} ${p.discount.percentage}% off)`
    : ''
  return (
    `${smsGymName(p.gymName)}: thank you, ${cleanSmsText(p.memberName)}! ` +
    `Payment of ${smsAmount(p.amountPaid)} received${discount}. ` +
    `Next due ${formatDateForDisplay(p.nextDueDate)}. Keep up the great work!`
  )
}

/**
 * Payment reminder, worded for its moment.
 *
 * Due today is the member's LAST active day (expiry is immediate, no grace),
 * so it says "expires today". Overdue is the safety net for a skipped expiry
 * run and says the membership has expired.
 *
 * @param type - Which reminder
 * @returns The reminder text
 */
export function reminderSms(
  type: ReminderType,
  p: SmsParty & {
    planType: PlanType | string
    amount: number
    dueDate: Date
  }
): string {
  const opening =
    `Hi ${cleanSmsText(p.memberName)}, your ${membership(p.planType)} ` +
    `at ${smsGymName(p.gymName)}`
  const amount = smsAmount(p.amount)
  const dueDate = formatDateForDisplay(p.dueDate)

  switch (type) {
    case ReminderType.DueToday:
      return `${opening} expires today (${amount}). Renew today and stay consistent!`
    case ReminderType.Overdue:
      return `${opening} has expired (due ${dueDate}, ${amount}). Renew soon and get back to training!`
    case ReminderType.SevenDay:
    case ReminderType.ThreeDay:
      return `${opening} is due on ${dueDate} (${amount}). Do not forget to renew and stay consistent!`
  }
}

/**
 * Day-pass receipt.
 *
 * @returns The day-pass text
 */
export function dayPassSms(
  p: SmsParty & {
    amountPaid: number
    validUntil: Date
  }
): string {
  return (
    `${smsGymName(p.gymName)}: thank you, ${cleanSmsText(p.memberName)}! ` +
    `Day pass of ${smsAmount(p.amountPaid)} received, ` +
    `valid until ${formatDateForDisplay(p.validUntil)}. Enjoy your workout!`
  )
}
