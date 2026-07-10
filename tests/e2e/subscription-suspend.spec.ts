/**
 * E2E: suspended-account state (tier strategy v2) — a gym suspended by
 * dunning or trial expiry sees the suspended plan card, cannot add active
 * members, and gets a checkout CTA back into its (preserved) tier.
 *
 * Gated like the other billing specs: E2E_BILLING=1 + a login gym seeded as
 * SUSPENDED (E2E_SUSPENDED_GYM=1 confirms; any tier — the tier is preserved
 * by suspension, the assertions are tier-agnostic).
 */

import { test, expect } from '@playwright/test';
import { loginAsGym, E2E_BILLING_ENABLED } from './helpers/billing';

test.skip(!E2E_BILLING_ENABLED, 'requires E2E_BILLING=1 + seeded billing environment');

test('suspended gym: suspended copy, subscribe CTA, no cancel, member add blocked', async ({
  page,
}) => {
  test.skip(process.env.E2E_SUSPENDED_GYM !== '1', 'requires a gym seeded as suspended');

  await loginAsGym(page);

  await page.goto('/settings/billing');
  // Suspended badge + explanation; the tier name is preserved (no Starter)
  await expect(page.getByText('Suspended').first()).toBeVisible();
  await expect(page.getByText(/until payment is\s+received/i)).toBeVisible();
  await expect(page.getByText(/starter/i)).toHaveCount(0);

  // Checkout back into the preserved tier is offered; cancel is not
  await expect(
    page.getByRole('button', { name: /subscribe to (lite|pro|enterprise)/i }).first()
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel subscription/i })).toHaveCount(0);

  // Adding an ACTIVE member is quota-blocked while suspended
  await page.goto('/members');
  await page.getByRole('button', { name: /add member/i }).first().click();
  await page.getByLabel(/^name/i).first().fill('Suspended Add Attempt');
  await page.getByLabel(/whatsapp number/i).fill('0771234598');
  await page.getByRole('button', { name: /next: payment/i }).click();
  await page.getByRole('button', { name: /create member/i }).click();
  await expect(page.getByTestId('quota-reached-upsell')).toBeVisible();
});
