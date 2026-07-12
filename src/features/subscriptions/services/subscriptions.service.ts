/**
 * Subscriptions feature — API client.
 *
 * Unwraps the ApiResponse envelope ({success, data, meta}) and throws typed
 * errors carrying the machine-readable error code for the UI to branch on
 * (e.g. MEMBER_LIMIT_REACHED handled by the members feature).
 */

import type {
  SerializedSubscription,
  BillingHistoryPage,
  CheckoutRedirectResponse,
} from '../types';
import type { SaasTier } from '@/core/utils/constants/SubscriptionConfig';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly status: number = 500
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function unwrap<T>(response: Response): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new ApiRequestError(
      body?.error?.message ?? 'Request failed',
      body?.error?.code ?? 'INTERNAL_ERROR',
      response.status
    );
  }
  return { data: body.data as T, meta: body.meta };
}

export interface SubscriptionWithPrice {
  subscription: SerializedSubscription;
  /** Monthly per-tier prices (LKR) from server config; null when billing env is absent */
  litePriceLkr: number | null;
  proPriceLkr: number | null;
  enterprisePriceLkr: number | null;
}

export async function getSubscription(): Promise<SubscriptionWithPrice> {
  const response = await fetch('/api/settings/subscription');
  const { data, meta } = await unwrap<SerializedSubscription>(response);
  return {
    subscription: data,
    litePriceLkr: typeof meta?.litePriceLkr === 'number' ? meta.litePriceLkr : null,
    proPriceLkr: typeof meta?.proPriceLkr === 'number' ? meta.proPriceLkr : null,
    enterprisePriceLkr:
      typeof meta?.enterprisePriceLkr === 'number' ? meta.enterprisePriceLkr : null,
  };
}

export async function startCheckout(input: {
  city: string;
  targetTier: SaasTier;
  phone?: string;
  address?: string;
}): Promise<CheckoutRedirectResponse> {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const { data } = await unwrap<CheckoutRedirectResponse>(response);
  return data;
}

export interface ChangePlanResult {
  subscription: SerializedSubscription;
  /** 'applied' = charged + provisioned; 'pending_confirmation' = charge in flight. */
  outcome: 'applied' | 'pending_confirmation';
}

/**
 * One-click tier change against the stored card token. Throws
 * ApiRequestError with code NO_SAVED_CARD when no token exists (fall back
 * to startCheckout) or CHARGE_FAILED when the card declined.
 */
export async function changePlan(targetTier: SaasTier): Promise<ChangePlanResult> {
  const response = await fetch('/api/billing/change-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTier }),
  });
  const { data, meta } = await unwrap<SerializedSubscription>(response);
  return {
    subscription: data,
    outcome: meta?.outcome === 'pending_confirmation' ? 'pending_confirmation' : 'applied',
  };
}

export async function cancelSubscription(): Promise<SerializedSubscription> {
  const response = await fetch('/api/billing/cancel', { method: 'POST' });
  const { data } = await unwrap<SerializedSubscription>(response);
  return data;
}

export async function getBillingHistory(page: number, limit = 20): Promise<BillingHistoryPage> {
  const response = await fetch(`/api/billing/history?page=${page}&limit=${limit}`);
  const { data, meta } = await unwrap<{ payments: BillingHistoryPage['payments'] }>(response);
  return {
    payments: data.payments,
    page: (meta?.page as number) ?? page,
    totalPages: (meta?.totalPages as number) ?? 1,
    totalCount: (meta?.totalCount as number) ?? data.payments.length,
  };
}
