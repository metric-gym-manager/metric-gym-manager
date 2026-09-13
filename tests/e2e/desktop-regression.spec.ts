/**
 * E2E: desktop screenshot baselines at 1366×800 (mobile rebuild plan §17
 * "Desktop regression", §19 gate 3, §24 "Presentation parity").
 *
 * The rebuild's contract with the desktop is *no change*: every `phone:`
 * rule is `max-width: 767px`, and the one desktop diff the plan allows is the
 * Door Access sidebar entry (o12). This spec is how that contract is checked
 * per phase — Dashboard, Members, Renewals, Revenue, Analytics, Settings/gym
 * and the member detail open, compared against baselines committed with
 * Phase 0. Runs on the `desktop-1366` project only.
 *
 * ## Reading a failure
 *
 * These are live-data screenshots of the seeded E2E gym, not fixtures, so a
 * diff has three possible causes and the report's diff image tells them
 * apart:
 *
 * 1. **Layout moved** — a toolbar wrapped, a column changed width, a control
 *    grew. This is what the spec exists to catch. Fix the regression.
 * 2. **Dates rolled** — "N days ago" counters and the month-scoped KPIs drift
 *    a little each day. `maxDiffPixelRatio` absorbs this; the dashboard's
 *    server timestamp is masked outright.
 * 3. **Data changed** — someone seeded or paid on the E2E gym. Re-baseline
 *    with `npx playwright test desktop-regression --update-snapshots` and say
 *    so in the PR; never re-baseline a phase's own diff without looking.
 *
 * The §28 stress fixtures are part of the pictured data (they are seeded in
 * `beforeAll`), so the baselines include the 1,000,000 plan and the 300
 * members.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { E2E_ACCESS_CONTROL_ENABLED } from './helpers/access-control'
import { STRESS, ensureStressFixtures } from './helpers/stress-fixtures'
import { gotoSettled, openTierPage, type TierPage } from './helpers/tier-page'

test.skip(
  !E2E_ACCESS_CONTROL_ENABLED,
  'requires E2E_ACCESS_CONTROL=1 + a seeded Enterprise gym'
)

/** Tolerates date drift; a layout regression moves far more than this. */
const TOLERANCE = { maxDiffPixelRatio: 0.02 }

const SCREENS = [
  { name: 'dashboard', route: '/dashboard' },
  { name: 'members', route: '/members' },
  { name: 'renewals', route: '/payment-collection' },
  { name: 'revenue', route: '/revenue' },
  { name: 'analytics', route: '/member-analytics' },
  { name: 'settings-gym', route: '/settings/gym' },
] as const

let tier: TierPage

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(600_000)
  tier = await openTierPage(browser, testInfo)
  const seeded = await ensureStressFixtures(tier.page.request)
  if (seeded.failed.length) {
    throw new Error(`stress fixtures failed: ${seeded.failed.join('; ')}`)
  }
})

test.afterAll(async () => {
  await tier?.context.close()
})

/** Regions that legitimately differ between runs. */
function volatile(page: Page) {
  return [
    // The dashboard header's server clock ("SEP 13 2026, 08:42 IST").
    page.getByText(/ IST$/),
    // Next's dev-tools badge, which carries an issue count.
    page.locator('nextjs-portal'),
  ]
}

async function stillPointer(page: Page): Promise<void> {
  // Park the pointer so no row or button is in its hover state.
  await page.mouse.move(0, 0)
}

for (const screen of SCREENS) {
  test(`${screen.name} matches its 1366 baseline`, async () => {
    const { page } = tier
    await gotoSettled(page, screen.route)
    await stillPointer(page)
    await expect(page).toHaveScreenshot(`${screen.name}.png`, {
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      mask: volatile(page),
      ...TOLERANCE,
    })
  })
}

test('member detail open matches its 1366 baseline', async () => {
  const { page } = tier
  await gotoSettled(page, '/members')

  // A fixture member, so the pictured detail is the same every run.
  await page.getByLabel('Search members').fill(STRESS.longName)
  const row = page.getByRole('row', { name: new RegExp(STRESS.longName) })
  await expect(row).toBeVisible()
  await row.click()

  const dialog = page.getByRole('dialog', { name: 'Member Details' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(STRESS.longName)).toBeVisible()
  // The detail loads in two steps (skeleton modal, then content).
  await expect(dialog.locator('.animate-pulse')).toHaveCount(0)
  await stillPointer(page)

  await expect(page).toHaveScreenshot('member-detail.png', {
    animations: 'disabled',
    caret: 'hide',
    mask: volatile(page),
    ...TOLERANCE,
  })
})
