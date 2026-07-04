/**
 * Subscription Gateway Interface (Port) — PayHere OAuth REST Subscription Manager.
 *
 * Gateway-authoritative operations on recurring subscriptions. Live PayHere
 * REST additionally requires server IP whitelisting (deployment config).
 */

export interface GatewaySubscriptionPayment {
  paymentId: string | null;
  date: string | null;
  amount: string | null;
  status: string | null;
}

export interface ISubscriptionGateway {
  /**
   * POST /merchant/v1/subscription/cancel.
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
