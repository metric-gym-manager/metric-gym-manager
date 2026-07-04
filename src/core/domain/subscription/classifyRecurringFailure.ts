/**
 * Coarse decline classification for PayHere recurring-payment failures (plan C-22).
 *
 * PayHere publishes no card-network decline codes; the only signals are the
 * redirect-notification `status_code`, the recurring `message_type`, and a
 * free-text `status_message`. Classification is therefore capture-first and
 * two-valued: it drives recovery UX copy and admin triage, never state
 * transitions (PayHere owns retry scheduling).
 */

import { RecurringFailureClass } from '@/core/utils/constants/SubscriptionConfig';

/**
 * Classify a failed PayHere notification.
 *
 * @param statusCode - Integer PayHere status_code (2 success, 0 pending, -1 canceled, -2 failed, -3 chargedback)
 * @param messageType - Recurring `message_type` field, if present
 * @returns Retriable when PayHere will retry the charge; Hard when no retry is coming
 */
export function classifyRecurringFailure(
  statusCode: number,
  messageType: string | null
): RecurringFailureClass {
  if (messageType === 'RECURRING_STOPPED') {
    return RecurringFailureClass.Hard;
  }
  if (statusCode === -2) {
    // Installment charge failed — PayHere retries automatically
    return RecurringFailureClass.Retriable;
  }
  // -1 (canceled), -3 (chargedback), and anything unrecognized: fail pessimistic
  return RecurringFailureClass.Hard;
}
