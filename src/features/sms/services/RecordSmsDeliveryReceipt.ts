import type { ISMSRepository } from './ISMSRepository'
import { SmsDeliveryStatus } from '../config/SmsConfig'

/**
 * Statuses text.lk reports on a delivery receipt, mapped to our own.
 *
 * Explicit and total: an unrecognised vendor status is **not** silently coerced.
 * The webhook route previously ended its `switch` with
 * `case 'SENT': case 'PENDING': default: deliveryStatus = 'sent'`, so any status
 * the vendor added later — or any typo — would have been recorded as a
 * successful dispatch. A status we do not understand is not evidence of
 * anything, and is reported back as unrecognised instead of being guessed at.
 *
 * `PENDING` maps to its own state rather than collapsing onto `sent`: the vendor
 * has accepted the message but not yet handed it to the carrier, which is a
 * different fact from "dispatched to the handset".
 */
const VENDOR_STATUS_MAP: Readonly<Record<string, SmsDeliveryStatus>> = {
  PENDING: SmsDeliveryStatus.Pending,
  SENT: SmsDeliveryStatus.Sent,
  DELIVERED: SmsDeliveryStatus.Delivered,
  FAILED: SmsDeliveryStatus.Failed,
  EXPIRED: SmsDeliveryStatus.Failed,
  REJECTED: SmsDeliveryStatus.Failed,
}

export type RecordSmsDeliveryReceiptResult =
  | { outcome: 'recorded'; status: SmsDeliveryStatus }
  | { outcome: 'unknown_status'; vendorStatus: string }
  /**
   * The update matched no row. Either the vendor id is one we never stored, or
   * the row is already in a terminal state and was deliberately left alone.
   * The two are not distinguished, because the webhook's response is the same
   * for both and telling them apart would cost a second query on every retry.
   */
  | { outcome: 'no_matching_row'; messageId: string }

/**
 * Apply one text.lk delivery report to its `sms_logs` row.
 *
 * Exists so the webhook route holds no business logic (R6). The mapping table
 * and the "did anything change" decision are domain concerns; the route's job is
 * signature verification, validation, and one call to this.
 *
 * Must be constructed with a **service-role** repository. `sms_logs` has no
 * UPDATE policy, so a session client's write is refused by RLS — and refused
 * silently, which is how this path reported success for seven months while
 * changing nothing.
 */
export class RecordSmsDeliveryReceipt {
  constructor(private readonly smsRepo: ISMSRepository) {}

  async execute(input: {
    messageId: string
    vendorStatus: string
  }): Promise<RecordSmsDeliveryReceiptResult> {
    const status = VENDOR_STATUS_MAP[input.vendorStatus.toUpperCase()]

    if (!status) {
      return { outcome: 'unknown_status', vendorStatus: input.vendorStatus }
    }

    const rowsAffected = await this.smsRepo.updateDeliveryStatus(
      input.messageId,
      status
    )

    if (rowsAffected === 0) {
      return { outcome: 'no_matching_row', messageId: input.messageId }
    }

    return { outcome: 'recorded', status }
  }
}
