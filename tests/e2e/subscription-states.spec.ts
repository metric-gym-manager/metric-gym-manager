/**
 * E2E: pending-confirmation, quota-block, cancel, and past-due states
 * (plan §6.3). All gated on a seeded billing environment.
 *
 * Seeding expectations per spec are documented inline; specs that need a
 * specific pre-seeded state skip unless the matching env flag is set, so a
 * partially-seeded environment still runs the rest.
 */

import { test, expect } from '@playwright/test';
import { loginAsGym, simulateWebhook, E2E_BILLING_ENABLED } from './helpers/billing';

test.skip(!E2E_BILLING_ENABLED, 'requires E2E_BILLING=1 + seeded billing environment');

test('webhook-absent path: verifying times out into PENDING_CONFIRMATION with a working refresh', async ({
  page,
  request,
}) => {
  await loginAsGym(page);

  await page.route('**/pay/checkout', (route) => route.fulfill({ status: 200, body: 'ok' }));
  await page.goto('/settings/billing');
  await page.getByRole('button', { name: /upgrade to pro/i }).first().click();
  await page.getByLabel(/billing city/i).fill('Colombo');
  const checkoutResponse = page.waitForResponse('**/api/billing/checkout');
  await page.getByRole('button', { name: /continue to payment/i }).click();
  const orderId = (await (await checkoutResponse).json()).data.orderId as string;

  // Return WITHOUT a webhook: 10s poll window elapses -> pending (not failure)
  await page.goto(`/settings/billing?order=${encodeURIComponent(orderId)}`);
  await expect(page.getByText(/still confirming/i)).toBeVisible({ timeout: 20_000 });

  // Late webhook + manual refresh resolves it
  await simulateWebhook(request, {
    order_id: orderId,
    payment_id: `E2E-LATE-${Date.now()}`,
    payhere_amount: Number(process.env.PAYHERE_PRO_PRICE_LKR ?? 4900).toFixed(2),
    status_code: '2',
    subscription_id: `E2E-PHSUB-LATE-${Date.now()}`,
  });
  await page.getByRole('button', { name: /refresh status/i }).click();
  await expect(page.getByText('Pro Plan')).toBeVisible({ timeout: 10_000 });
});

test('quota block: at-limit gym sees the upsell in the add-member modal and lands on billing', async ({
  page,
}) => {
  // Requires a gym seeded AT the free limit (E2E_AT_LIMIT_GYM=1 confirms)
  test.skip(process.env.E2E_AT_LIMIT_GYM !== '1', 'requires a gym seeded at the member limit');

  await loginAsGym(page);
  await page.goto('/members');
  await page.getByRole('button', { name: /add member/i }).first().click();

  await page.getByLabel(/name/i).first().fill('Overflow Member');
  await page.getByLabel(/phone/i).first().fill('0771234599');
  await page.getByRole('button', { name: /next/i }).click();
  await page.getByRole('button', { name: /register|complete/i }).click();

  const upsell = page.getByTestId('quota-reached-upsell');
  await expect(upsell).toBeVisible();
  await upsell.getByRole('link', { name: /upgrade to pro/i }).click();
  await page.waitForURL('**/settings/billing**');
  await expect(page.getByText(/free plan/i).first()).toBeVisible();
});

test('cancel: consequence disclosure -> Pro-until-date state, cancel button gone', async ({
  page,
}) => {
  // Requires a gym seeded as pro/active (E2E_PRO_GYM=1 confirms)
  test.skip(process.env.E2E_PRO_GYM !== '1', 'requires a gym seeded as pro/active');

  await loginAsGym(page);
  await page.goto('/settings/billing');
  await expect(page.getByText('Pro Plan')).toBeVisible();

  await page.getByRole('button', { name: /cancel subscription/i }).click();
  // Consequence disclosure copy (plan §5.4 flow 4)
  await expect(page.getByText(/keep pro features until/i)).toBeVisible();
  await expect(page.getByText(/members and all data are kept/i)).toBeVisible();
  await expect(page.getByText(/no further charges/i)).toBeVisible();

  await page.getByRole('button', { name: /^cancel subscription$/i }).last().click();

  await expect(page.getByText(/pro features continue until/i)).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole('button', { name: /cancel subscription/i })
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: /re-subscribe to pro/i })).toBeVisible();
});

test('past-due state renders the grace banner', async ({ page }) => {
  // Requires a gym seeded as pro/past_due (E2E_PAST_DUE_GYM=1 confirms)
  test.skip(process.env.E2E_PAST_DUE_GYM !== '1', 'requires a gym seeded as pro/past_due');

  await loginAsGym(page);
  await page.goto('/settings/billing');
  await expect(page.getByRole('alert')).toContainText(/payment (failed|method declined)/i);
  await expect(page.getByRole('alert')).toContainText(/pro features continue until/i);
});
