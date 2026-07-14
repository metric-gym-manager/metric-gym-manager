/**
 * Subscriptions feature — public types.
 */

import type { SerializedSubscription } from '../utils/serializeSubscriptionForAPI';

export type { SerializedSubscription };

export interface BillingHistoryRow {
  id: string;
  date: string;
  orderId: string | null;
  order_id: string | null;
  paymentId: string | null;
  payment_id: string | null;
  status: 'paid' | 'pending' | 'failed';
  amount: string | null;
  currency: string | null;
}

export interface BillingHistoryPage {
  payments: BillingHistoryRow[];
  page: number;
  totalPages: number;
  totalCount: number;
}

export interface CheckoutRedirectResponse {
  checkoutUrl: string;
  params: Record<string, string>;
  orderId: string;
}

/** Post-redirect verification state (plan §5.4 flow 1). */
export type PaymentPollState = 'idle' | 'verifying' | 'success' | 'pending';
