/**
 * PayHere configuration — lazy, cached, Zod-validated env access.
 *
 * Lazy (first-call) parsing instead of module-load parsing keeps unit tests
 * hermetic: suites can stub process.env and call __resetPayhereConfigForTests()
 * without fighting the Jest module registry.
 *
 * The Merchant Secret and App Secret never leave this module's consumers on
 * the server side; they are never logged and never serialized to any client.
 */

import { z } from 'zod';

const payhereEnvSchema = z.object({
  PAYHERE_MODE: z.enum(['sandbox', 'live']),
  PAYHERE_MERCHANT_ID: z.string().min(1),
  PAYHERE_MERCHANT_SECRET: z.string().min(1),
  PAYHERE_LITE_PRICE_LKR: z.coerce.number().positive(),
  // Repurposed variable: 4900 (pro-original) -> 2990 (growth) -> 4990
  // (pro-new). The NAME is stable; the MEANING changed with the Lite/Pro/
  // Enterprise re-anchor — see docs/DEPLOYMENT_PAYHERE_CHECKLIST.md.
  PAYHERE_PRO_PRICE_LKR: z.coerce.number().positive(),
  PAYHERE_ENTERPRISE_PRICE_LKR: z.coerce.number().positive(),
  PAYHERE_APP_ID: z.string().min(1),
  PAYHERE_APP_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export interface PayhereConfig {
  mode: 'sandbox' | 'live';
  merchantId: string;
  merchantSecret: string;
  litePriceLkr: number;
  proPriceLkr: number;
  enterprisePriceLkr: number;
  appId: string;
  appSecret: string;
  /** Mode-derived PayHere origin, e.g. https://sandbox.payhere.lk */
  baseUrl: string;
  /** Redirect/form checkout endpoint: {baseUrl}/pay/checkout */
  checkoutUrl: string;
  /** OAuth REST base: {baseUrl}/merchant/v1 */
  restBaseUrl: string;
  /** Browser return target after payment (gateway appends ?order=) */
  returnUrl: string;
  /** Browser return target after user-cancel on PayHere */
  cancelUrl: string;
  /** Server-to-server notification endpoint; must be publicly reachable */
  notifyUrl: string;
}

let cached: PayhereConfig | null = null;

/**
 * Parse and cache the PayHere configuration from process.env.
 *
 * @throws Error naming every missing/invalid variable
 */
export function getPayhereConfig(): PayhereConfig {
  if (cached) {
    return cached;
  }

  const parsed = payhereEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`PayHere configuration invalid or missing env vars: ${missing}`);
  }

  const env = parsed.data;
  const baseUrl =
    env.PAYHERE_MODE === 'live' ? 'https://www.payhere.lk' : 'https://sandbox.payhere.lk';
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');

  cached = {
    mode: env.PAYHERE_MODE,
    merchantId: env.PAYHERE_MERCHANT_ID,
    merchantSecret: env.PAYHERE_MERCHANT_SECRET,
    litePriceLkr: env.PAYHERE_LITE_PRICE_LKR,
    proPriceLkr: env.PAYHERE_PRO_PRICE_LKR,
    enterprisePriceLkr: env.PAYHERE_ENTERPRISE_PRICE_LKR,
    appId: env.PAYHERE_APP_ID,
    appSecret: env.PAYHERE_APP_SECRET,
    baseUrl,
    checkoutUrl: `${baseUrl}/pay/checkout`,
    restBaseUrl: `${baseUrl}/merchant/v1`,
    returnUrl: `${appUrl}/settings/billing`,
    cancelUrl: `${appUrl}/settings/billing?canceled=1`,
    notifyUrl: `${appUrl}/api/webhooks/payhere`,
  };

  return cached;
}

/**
 * Test-only cache reset. Not for production code paths.
 */
export function __resetPayhereConfigForTests(): void {
  cached = null;
}
