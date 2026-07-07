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
  await expect(page.getByText('Starter Plan')).toBeVisible();
  // Starter gyms get no avatar ring
  await expect(page.getByTestId('growth-avatar-ring')).toHaveCount(0);

  // Block the actual cross-origin PayHere navigation; capture the form POST.
  // The order id is read from the intercepted hand-off body (what PayHere
  // would receive) — reading the checkout API response instead races the
  // auto-submitted form navigation, which evicts the response body.
  let checkoutPosted = false;
  let orderId = '';
  await page.route('**/pay/checkout', (route) => {
    checkoutPosted = true;
    orderId = new URLSearchParams(route.request().postData() ?? '').get('order_id') ?? '';
    return route.fulfill({ status: 200, body: 'intercepted' });
  });

  // Start the upgrade
  await page.getByRole('button', { name: /upgrade to growth/i }).first().click();
  await page.getByLabel(/billing city/i).fill('Colombo');
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await expect.poll(() => checkoutPosted).toBe(true);
  expect(orderId).toMatch(/^SUB-/);

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

  // Poll flips to SUCCESS; plan card shows Growth
  await expect(page.getByText(/you'?re on growth/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Growth Plan')).toBeVisible();

  // Positive-reinforcement marker: the header avatar gains the Growth ring
  // (the shared subscription query is invalidated by the successful poll)
  await expect(page.getByTestId('growth-avatar-ring')).toBeVisible({ timeout: 10_000 });
});

test('canceled return shows the not-charged panel', async ({ page }) => {
  await loginAsGym(page);
  await page.goto('/settings/billing?canceled=1');
  await expect(page.getByText(/payment canceled/i)).toBeVisible();
  await expect(page.getByText(/have not been charged/i)).toBeVisible();
});
