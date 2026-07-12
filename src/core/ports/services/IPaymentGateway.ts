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
  /** Gateway form-POST target (mode-derived preapproval URL) */
  checkoutUrl: string;
  /** Complete form field set incl. hash — safe for the client (no secrets) */
  params: Record<string, string>;
}

export interface IPaymentGateway {
  /**
   * Assemble the Preapproval redirect (fields + signed hash): the customer
   * authorizes their card on PayHere, the first month's price is captured
   * as a payment alongside the preapproval, and the notification returns
   * the reusable `customer_token` that powers all subsequent
   * server-initiated charges (Charging API).
   */
  buildPreapprovalRedirect(input: {
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
