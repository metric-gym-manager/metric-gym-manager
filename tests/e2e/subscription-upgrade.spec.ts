/**
 * E2E: upgrade flow (plan §6.3) — Free gym -> billing page -> upgrade dialog
 * -> intercepted PayHere hand-off -> simulated return -> VERIFYING ->
 * simulated webhook -> SUCCESS -> plan card shows Pro.
 *
 * Preconditions: dev server + Supabase with migrations; seeded FREE gym
 * (E2E_GYM_EMAIL/E2E_GYM_PASSWORD); PayHere env matching the server.
 */

import { test, expect } from '@playwright/test';
import { loginAsGym, simulateWebhook, E2E_BILLING_ENABLED } from './helpers/billing';

test.skip(!E2E_BILLING_ENABLED, 'requires E2E_BILLING=1 + seeded billing environment');

test('upgrade: checkout -> return -> verifying -> webhook -> Pro', async ({ page, request }) => {
  await loginAsGym(page);

  await page.goto('/settings/billing');
  await expect(page.getByText('Free Plan')).toBeVisible();

  // Block the actual cross-origin PayHere navigation; capture the form POST
  let checkoutPosted = false;
  await page.route('**/pay/checkout', (route) => {
    checkoutPosted = true;
    return route.fulfill({ status: 200, body: 'intercepted' });
  });

  // Start the upgrade
  await page.getByRole('button', { name: /upgrade to pro/i }).first().click();
  await page.getByLabel(/billing city/i).fill('Colombo');

  // Capture the orderId from the checkout API response
  const checkoutResponse = page.waitForResponse('**/api/billing/checkout');
  await page.getByRole('button', { name: /continue to payment/i }).click();
  const checkoutBody = await (await checkoutResponse).json();
  const orderId: string = checkoutBody.data.orderId;
  expect(orderId).toMatch(/^SUB-/);
  await expect.poll(() => checkoutPosted).toBe(true);

  // Simulate the browser return from PayHere -> VERIFYING
  await page.goto(`/settings/billing?order=${encodeURIComponent(orderId)}`);
  await expect(page.getByText(/verifying your payment/i)).toBeVisible();

  // Authoritative confirmation: simulated signed webhook
  await simulateWebhook(request, {
    order_id: orderId,
    payment_id: `E2E-PAY-${Date.now()}`,
    payhere_amount: Number(process.env.PAYHERE_PRO_PRICE_LKR ?? 4900).toFixed(2),
    status_code: '2',
    subscription_id: `E2E-PHSUB-${Date.now()}`,
  });

  // Poll flips to SUCCESS; plan card shows Pro
  await expect(page.getByText(/you'?re on pro/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Pro Plan')).toBeVisible();
});

test('canceled return shows the not-charged panel', async ({ page }) => {
  await loginAsGym(page);
  await page.goto('/settings/billing?canceled=1');
  await expect(page.getByText(/payment canceled/i)).toBeVisible();
  await expect(page.getByText(/have not been charged/i)).toBeVisible();
});
