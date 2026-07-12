/**
 * Subscription Gateway Interface (Port) — PayHere OAuth REST Merchant APIs.
 *
 * Gateway-authoritative operations: charging stored card tokens (Charging
 * API — the billing engine of the token model) and managing legacy recurring
 * subscriptions. Live PayHere REST additionally requires server IP
 * whitelisting (deployment config).
 */

export interface GatewaySubscriptionPayment {
  paymentId: string | null;
  date: string | null;
  amount: string | null;
  status: string | null;
}

export interface TokenChargeInput {
  /** Server-generated order id — already persisted as a pending charge attempt. */
  orderId: string;
  /** Flat tier price (amount authority: from config, never a request). */
  amount: number;
  currency: 'LKR';
  /** Stored Preapproval customer token (gyms.payhere_customer_id). */
  customerToken: string;
  /** PayHere line-item label. */
  items: string;
  /** Webhook attribution fallback (custom_1). */
  gymId: string;
}

export interface TokenChargeResult {
  /** PayHere payment id (idempotency anchor) — null when the response omitted it. */
  paymentId: string | null;
  /** 2 success · 0 pending · -1 canceled · -2 failed. */
  statusCode: number;
  statusMessage: string | null;
  /** Response md5sig verified against our request tuple. NEVER act on state when false. */
  signatureValid: boolean;
  /** Raw response payload for the audit log (md5sig redacted). */
  rawPayload: Record<string, unknown>;
}

export interface ISubscriptionGateway {
  /**
   * POST /merchant/v1/payment/charge — charge a preapproved card token.
   *
   * Synchronous: the business outcome (success/failure) is in the RESULT,
   * not an exception. Throws only for transport/auth faults where the
   * outcome is UNKNOWN — callers must leave the pending charge attempt open
   * so the notify webhook (or attempt expiry) resolves it; never retry
   * inline (double-charge risk).
   *
   * @throws ExternalServiceError on network/auth faults (outcome unknown)
   */
  chargeCustomerToken(input: TokenChargeInput): Promise<TokenChargeResult>;

  /**
   * POST /merchant/v1/subscription/cancel — LEGACY recurring subscriptions
   * only (token billing has nothing scheduled at the gateway).
   *
   * Resolves on success OR when the subscription is already
   * cancelled/completed (idempotent: a retried user click is not an error).
   *
   * @throws ExternalServiceError on auth errors, network faults, or any
   *         non-idempotent failure — callers must NOT change local state then.
   */
  cancelSubscription(payhereSubscriptionId: string): Promise<void>;

  /**
   * GET /merchant/v1/subscription/{id}/payments — admin-side reconciliation
   * only; the gym-facing billing history reads saas_payment_logs (plan C-12).
   */
  listSubscriptionPayments(payhereSubscriptionId: string): Promise<GatewaySubscriptionPayment[]>;
}
