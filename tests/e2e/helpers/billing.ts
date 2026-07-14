/**
 * E2E helpers for the billing flows (plan §6.3).
 *
 * Requirements (all specs skip without them):
 *   E2E_BILLING=1
 *   E2E_GYM_EMAIL / E2E_GYM_PASSWORD  — seeded gym-manager login
 *   PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET — must match the dev
 *   server's env so simulated webhooks verify.
 *
 * PayHere itself is never driven: the webhook is simulated by POSTing a
 * correctly-signed form body to /api/webhooks/payhere.
 */

import { createHash } from 'crypto';
import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

export const E2E_BILLING_ENABLED = process.env.E2E_BILLING === '1';

const md5Upper = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();

export async function loginAsGym(page: Page): Promise<void> {
  await page.goto('/login');
  // Dev-mode hydration can lag behind first paint: values filled into the
  // uncontrolled DOM are wiped when React hydrates the controlled inputs and
  // clicks are swallowed. Re-fill and re-click until the request fires.
  await expect(async () => {
    await page.getByLabel(/email/i).fill(process.env.E2E_GYM_EMAIL ?? '');
    await page.getByLabel(/password/i).fill(process.env.E2E_GYM_PASSWORD ?? '');
    const loginResponse = page.waitForResponse('**/api/auth/login', { timeout: 3000 });
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();
    await loginResponse;
  }).toPass({ timeout: 30_000 });
  await page.waitForURL('**/dashboard**');
}

export interface SimulatedWebhook {
  order_id: string;
  payment_id: string;
  payhere_amount: string;
  status_code: string;
  subscription_id?: string;
  custom_1?: string;
  message_type?: string;
  item_rec_status?: string;
}

/** POST a correctly-signed notification to the running dev server. */
export async function simulateWebhook(
  request: APIRequestContext,
  fields: SimulatedWebhook
): Promise<void> {
  const merchantId = process.env.PAYHERE_MERCHANT_ID ?? '';
  const secret = process.env.PAYHERE_MERCHANT_SECRET ?? '';
  const form: Record<string, string> = {
    merchant_id: merchantId,
    payhere_currency: 'LKR',
    ...Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    ) as Record<string, string>,
  };
  form.md5sig = md5Upper(
    merchantId +
      form.order_id +
      form.payhere_amount +
      form.payhere_currency +
      form.status_code +
      md5Upper(secret)
  );

  const response = await request.post('/api/webhooks/payhere', { form });
  if (response.status() !== 200) {
    throw new Error(`Simulated webhook returned ${response.status()}`);
  }
}
