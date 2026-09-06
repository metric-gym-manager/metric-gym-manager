/**
 * SMS domain authority — the single owner of the two `sms_logs` enums.
 *
 * Why this file exists: the same two enums were declared in **three** places,
 * each disagreeing with the database and with each other.
 *
 * | Declaration                      | `sms_type`                          | `delivery_status`         |
 * | -------------------------------- | ----------------------------------- | ------------------------- |
 * | `types/index.ts`                 | 7 values (correct)                  | missing `pending`         |
 * | `schemas/sms.schemas.ts`         | **5** — no `welcome`/`reactivation` | missing `pending`         |
 * | `services/ISMSRepository.ts`     | 3 values the DB has never had       | had `pending` (DB didn't) |
 *
 * That drift is not academic. `types/index.ts` also declared `SMSLog.created_at`,
 * a column `sms_logs` does not have, and the member-history read selected it — so
 * `GET /api/members/[id]/sms-history` returned 500 on every call it ever served.
 * The same class had already caused two production insert failures, each fixed by
 * a migration after the fact (`welcome`, `reactivation`).
 *
 * Rule 2.2 requires domain enums to be validated with `z.nativeEnum()` against one
 * owner rather than a duplicated `z.enum()` set, and R5 requires single ownership
 * of a shared domain concept. This file is that owner; `schemas/`, `types/` and the
 * repository port all derive from it. Keep it in step with the database:
 * `delivery_status` and `sms_type` in `supabase/migrations/`.
 */

import { ReminderType } from './ReminderConfig'

/**
 * Delivery state of a logged message.
 *
 * Mirrors the `delivery_status` Postgres enum exactly. `pending` was added to the
 * database in `20260905000001` — it had been declared in TypeScript and rejected
 * by Postgres until then.
 *
 * - `pending`   — accepted by the vendor, not yet handed to the carrier.
 * - `sent`      — dispatched. The value a row is created with.
 * - `delivered` — the carrier confirmed handset receipt, via the delivery webhook.
 * - `failed`    — the send was rejected, or the carrier reported final failure.
 */
export enum SmsDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Delivered = 'delivered',
  Failed = 'failed',
}

/**
 * Message kinds that are not reminders. The four reminder kinds are owned by
 * `ReminderType` in `ReminderConfig.ts` and composed in below rather than
 * re-listed, so there is exactly one place where a reminder kind is named (R5).
 */
export const NON_REMINDER_SMS_TYPES = [
  'receipt',
  'welcome',
  'reactivation',
] as const

export type NonReminderSmsType = (typeof NON_REMINDER_SMS_TYPES)[number]

/** Every value of the `sms_type` Postgres enum, and nothing else. */
export type SmsType = ReminderType | NonReminderSmsType

/** Runtime list, for Zod and for exhaustiveness checks. */
export const SMS_TYPES: readonly SmsType[] = [
  ...Object.values(ReminderType),
  ...NON_REMINDER_SMS_TYPES,
]

/**
 * Terminal states — a delivery report can never move a row out of one of these.
 * Used by the delivery webhook to ignore a late or out-of-order receipt rather
 * than regress a row that already reached its final state.
 */
export const TERMINAL_DELIVERY_STATUSES: readonly SmsDeliveryStatus[] = [
  SmsDeliveryStatus.Delivered,
  SmsDeliveryStatus.Failed,
]
