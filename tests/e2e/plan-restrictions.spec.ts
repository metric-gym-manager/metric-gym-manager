/**
 * E2E: plan restrictions on the paid-only Lite/Pro/Enterprise ladder —
 * Lite-only limit bar + universal upgrade CTA; announcements available on
 * every tier. Gated like the other billing specs: E2E_BILLING=1 + seeded
 * gym; per-state flags choose which side runs.
 */

import { test, expect } from '@playwright/test';
import { loginAsGym, E2E_BILLING_ENABLED } from './helpers/billing';

test.skip(!E2E_BILLING_ENABLED, 'requires E2E_BILLING=1 + seeded billing environment');

test('Lite gym at the cap: limit bar everywhere except settings; announcements open', async ({
  page,
}) => {
  // Requires a LITE-tier login gym (E2E_AT_LIMIT_GYM=1 confirms it is at 100)
  test.skip(process.env.E2E_AT_LIMIT_GYM !== '1', 'requires a lite gym seeded at the limit');

  await loginAsGym(page);

  // Bar on the dashboard, in the at-limit state, with the upgrade CTA
  const bar = page.getByTestId('member-limit-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(/member limit reached/i);
  await expect(bar.getByRole('link', { name: /upgrade/i })).toHaveAttribute(
    'href',
    '/settings/billing'
  );

  // Bar on another page too (site-wide chrome)
  await page.goto('/members');
  await expect(page.getByTestId('member-limit-bar')).toBeVisible();

  // ...but never under /settings
  await page.goto('/settings/billing');
  await expect(page.getByText('Lite Plan')).toBeVisible();
  await expect(page.getByTestId('member-limit-bar')).toHaveCount(0);

  // Announcements are universal on the paid-only ladder — the composer
  // renders, no upgrade panel
  await page.goto('/make-announcement');
  await expect(page.getByTestId('feature-gate-upsell')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /send/i }).first()).toBeVisible();
});

test('Pro gym: unlimited (no usage bar), announcements fully available', async ({ page }) => {
  // Requires the login gym seeded as pro/active (E2E_PRO_GYM=1 confirms)
  test.skip(process.env.E2E_PRO_GYM !== '1', 'requires a gym seeded as pro/active');

  await loginAsGym(page);

  // Pro is uncapped -> no usage bar anywhere
  await expect(page.getByTestId('member-limit-bar')).toHaveCount(0);

  await page.goto('/make-announcement');
  await expect(page.getByTestId('feature-gate-upsell')).toHaveCount(0);
  // The real composer renders (message box + send controls)
  await expect(page.getByRole('button', { name: /send/i }).first()).toBeVisible();
});

test('Enterprise (lifetime/comped) gym: no bar, billing controls greyed, features open', async ({
  page,
}) => {
  // Requires the login gym seeded as complimentary enterprise (E2E_ENTERPRISE_GYM=1)
  test.skip(
    process.env.E2E_ENTERPRISE_GYM !== '1',
    'requires a gym seeded as complimentary enterprise'
  );

  await loginAsGym(page);

  // Unlimited -> no usage bar anywhere
  await expect(page.getByTestId('member-limit-bar')).toHaveCount(0);

  // Announcements available (universal)
  await page.goto('/make-announcement');
  await expect(page.getByTestId('feature-gate-upsell')).toHaveCount(0);

  // Billing page: Lifetime badge + subscription management greyed out, not removed
  await page.goto('/settings/billing');
  await expect(page.getByText('Enterprise Plan', { exact: true })).toBeVisible();
  await expect(page.getByText('Lifetime').first()).toBeVisible();
  await expect(page.getByText(/managed by us/i).first()).toBeVisible();
  // No enabled cancel/upgrade actions for a comped gym
  const managed = page.getByRole('button', { name: /subscription managed by us/i });
  await expect(managed).toBeVisible();
  await expect(managed).toBeDisabled();
});
