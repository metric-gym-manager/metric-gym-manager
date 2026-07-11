/**
 * PayHere OAuth REST Subscription Manager gateway — implements ISubscriptionGateway.
 *
 * Token flow (PayHere API reference):
 *   POST {restBaseUrl}/oauth/token
 *     Authorization: Basic base64(appId:appSecret)
 *     Body: grant_type=client_credentials
 * Tokens live ~10 minutes; cached module-wide and refreshed only on expiry —
 * per-request fetching would triple latency and hammer the token endpoint.
 *
 * Live REST additionally requires server IP whitelisting (deployment config;
 * see docs/SAAS_SUBSCRIPTION_IMPLEMENTATION.md runbook).
 */

import type {
  ISubscriptionGateway,
  GatewaySubscriptionPayment,
  TokenChargeInput,
  TokenChargeResult,
} from '@/core/ports/services';
import { ExternalServiceError } from '@/core/utils/errors';
import { getPayhereConfig } from '@/lib/payhere/config';
import { verifyNotificationSignature, formatAmount } from '@/lib/payhere/crypto';

interface TokenCache {
  token: string;
  /** Epoch ms after which the token must be refreshed */
  expiresAt: number;
}

/** Refresh 60s before nominal expiry to absorb clock skew and in-flight time. */
const EXPIRY_SAFETY_MS = 60_000;

let tokenCache: TokenCache | null = null;

/** Test-only cache reset. */
export function __resetPayhereTokenCacheForTests(): void {
  tokenCache = null;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const config = getPayhereConfig();
  const basic = Buffer.from(`${config.appId}:${config.appSecret}`).toString('base64');

  const res = await fetch(`${config.restBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new ExternalServiceError('PayHere', `OAuth token request failed (HTTP ${res.status})`);
  }

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new ExternalServiceError('PayHere', 'OAuth token response missing access_token');
  }

  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 599) * 1000 - EXPIRY_SAFETY_MS,
  };
  return tokenCache.token;
}

interface PayhereRestEnvelope {
  status?: number;
  msg?: string;
  data?: unknown;
}

export class PayHereSubscriptionGateway implements ISubscriptionGateway {
  async chargeCustomerToken(input: TokenChargeInput): Promise<TokenChargeResult> {
    const config = getPayhereConfig();
    const token = await getAccessToken();

    let res: Response;
    let body: PayhereRestEnvelope;
    try {
      res = await fetch(`${config.restBaseUrl}/payment/charge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'PAYMENT',
          order_id: input.orderId,
          items: input.items,
          currency: input.currency,
          amount: formatAmount(input.amount),
          customer_token: input.customerToken,
          custom_1: input.gymId, // webhook attribution for the async confirmation
          notify_url: config.notifyUrl,
        }),
      });
      body = (await res.json()) as PayhereRestEnvelope;
    } catch (e) {
      // Transport fault: the charge outcome is UNKNOWN. The caller must leave
      // the pending charge attempt open — the notify webhook (or attempt
      // expiry) resolves it. Never retry inline: double-charge risk.
      throw new ExternalServiceError(
        'PayHere',
        `payment/charge transport failure (outcome unknown): ${
          e instanceof Error ? e.message : 'unknown'
        }`
      );
    }

    if (!res.ok) {
      throw new ExternalServiceError('PayHere', `payment/charge HTTP ${res.status}`);
    }

    // Envelope status -1/-2 with no payment data = the charge was REJECTED
    // before processing (invalid token, auth error) — a definite failure.
    const data = (body.data ?? null) as Record<string, unknown> | null;
    if (body.status !== 1 && !data) {
      return {
        paymentId: null,
        statusCode: -2,
        statusMessage: body.msg ?? `payment/charge rejected (status ${body.status ?? 'unknown'})`,
        signatureValid: false,
        rawPayload: { status: body.status ?? null, msg: body.msg ?? null },
      };
    }

    const statusCode = Number.parseInt(String(data?.status_code ?? ''), 10);
    const paymentId =
      typeof data?.payment_id === 'string' || typeof data?.payment_id === 'number'
        ? String(data.payment_id)
        : null;
    const md5sig = typeof data?.md5sig === 'string' ? data.md5sig : '';

    // Verify the response signature against OUR request tuple (same 5-tuple
    // formula as notifications). A charge outcome with a bad signature is
    // never acted on.
    const signatureValid = verifyNotificationSignature(config.merchantSecret, {
      merchant_id: config.merchantId,
      order_id: input.orderId,
      payhere_amount: formatAmount(input.amount),
      payhere_currency: input.currency,
      status_code: String(data?.status_code ?? ''),
      md5sig,
    });

    const rawPayload: Record<string, unknown> = { ...(data ?? {}), md5sig: '[REDACTED]' };

    return {
      paymentId,
      statusCode: Number.isNaN(statusCode) ? -2 : statusCode,
      statusMessage: typeof data?.status_message === 'string' ? data.status_message : null,
      signatureValid,
      rawPayload,
    };
  }

  async cancelSubscription(payhereSubscriptionId: string): Promise<void> {
    const config = getPayhereConfig();
    const token = await getAccessToken();

    let res: Response;
    try {
      res = await fetch(`${config.restBaseUrl}/subscription/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription_id: payhereSubscriptionId }),
      });
    } catch (e) {
      throw new ExternalServiceError(
        'PayHere',
        `subscription/cancel network failure: ${e instanceof Error ? e.message : 'unknown'}`
      );
    }

    if (!res.ok) {
      throw new ExternalServiceError('PayHere', `subscription/cancel HTTP ${res.status}`);
    }

    const body = (await res.json()) as PayhereRestEnvelope;

    if (body.status === 1) {
      return; // cancelled
    }

    // Idempotent semantics: an already-cancelled/completed subscription is
    // success from the caller's perspective (a retried user click is not an error).
    const msg = (body.msg ?? '').toLowerCase();
    if (body.status === -1 && (msg.includes('already') || msg.includes('cancel') || msg.includes('complete'))) {
      return;
    }

    throw new ExternalServiceError(
      'PayHere',
      `subscription/cancel rejected (status ${body.status ?? 'unknown'})`
    );
  }

  async listSubscriptionPayments(
    payhereSubscriptionId: string
  ): Promise<GatewaySubscriptionPayment[]> {
    const config = getPayhereConfig();
    const token = await getAccessToken();

    const res = await fetch(
      `${config.restBaseUrl}/subscription/${encodeURIComponent(payhereSubscriptionId)}/payments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      throw new ExternalServiceError('PayHere', `subscription payments HTTP ${res.status}`);
    }

    const body = (await res.json()) as PayhereRestEnvelope;
    if (body.status !== 1 || !Array.isArray(body.data)) {
      throw new ExternalServiceError(
        'PayHere',
        `subscription payments rejected (status ${body.status ?? 'unknown'})`
      );
    }

    return (body.data as Record<string, unknown>[]).map((p) => ({
      paymentId: typeof p.payment_id === 'string' || typeof p.payment_id === 'number'
        ? String(p.payment_id)
        : null,
      date: typeof p.date === 'string' ? p.date : null,
      amount: typeof p.amount === 'string' || typeof p.amount === 'number'
        ? String(p.amount)
        : null,
      status: typeof p.status === 'string' ? p.status : null,
    }));
  }
}
