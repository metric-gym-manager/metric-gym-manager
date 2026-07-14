/**
 * PayHere signature algorithms — exact formulas from the PayHere API reference.
 *
 * Outbound checkout hash:
 *   hash = UPPER(md5(merchant_id + order_id + amount(2dp) + currency + UPPER(md5(merchant_secret))))
 *
 * Inbound notification verification:
 *   md5sig = UPPER(md5(merchant_id + order_id + payhere_amount + payhere_currency
 *                      + status_code + UPPER(md5(merchant_secret))))
 *   computed over the RAW received strings — never re-parse or re-format
 *   payhere_amount / status_code before hashing.
 *
 * Secrets are passed in, not imported — keeps this module pure and
 * unit-testable without environment access. Node crypto only: every consumer
 * route must declare `export const runtime = 'nodejs'`.
 */

import { createHash, timingSafeEqual } from 'crypto';

const md5Upper = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();

/**
 * Mirrors PHP number_format(x, 2, '.', '') — two decimals, no thousands separator.
 */
export const formatAmount = (n: number): string => n.toFixed(2);

/**
 * Outbound checkout hash for redirect/form APIs.
 */
export function generateCheckoutHash(
  merchantId: string,
  merchantSecret: string,
  orderId: string,
  amount: number,
  currency: string
): string {
  return md5Upper(
    merchantId + orderId + formatAmount(amount) + currency + md5Upper(merchantSecret)
  );
}

/**
 * Notification signature fields (raw strings as received).
 */
export interface NotificationSignatureFields {
  merchant_id: string;
  order_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
  md5sig: string;
}

/**
 * Verify an inbound PayHere notification signature. Constant-time compare
 * with a length guard (length is not secret).
 */
export function verifyNotificationSignature(
  merchantSecret: string,
  f: NotificationSignatureFields
): boolean {
  if (!f.md5sig) {
    return false;
  }
  const local = md5Upper(
    f.merchant_id +
      f.order_id +
      f.payhere_amount +
      f.payhere_currency +
      f.status_code +
      md5Upper(merchantSecret)
  );
  const a = Buffer.from(local);
  const b = Buffer.from(f.md5sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
