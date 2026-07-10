/**
 * Payment Gateway Interface (Port) — redirect/form checkout family.
 *
 * Implemented by PayHereGateway (infrastructure). The core never sees the
 * Merchant Secret; it receives ready-made form params + target URL.
 */

import type { SaasTier } from '@/core/utils/constants/SubscriptionConfig';

export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}

export interface CheckoutRedirect {
  /** Gateway form-POST target (mode-derived checkout URL) */
  checkoutUrl: string;
  /** Complete form field set incl. hash — safe for the client (no secrets) */
  params: Record<string, string>;
}

export interface IPaymentGateway {
  /**
   * Assemble the recurring-checkout redirect (fields + signed hash).
   */
  buildCheckoutRedirect(input: {
    orderId: string;
    amount: number;
    currency: 'LKR';
    /** Tier being purchased (all tiers are paid) — used for the PayHere line-item label. */
    tier: SaasTier;
    gymId: string;
    customer: CheckoutCustomer;
  }): CheckoutRedirect;

  /**
   * Verify an inbound notification signature over the raw received strings.
   */
  verifyNotificationSignature(fields: Record<string, string>): boolean;
}