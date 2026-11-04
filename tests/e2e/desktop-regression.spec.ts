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
 * ## What is pictured
 *
 * One synthetic gym from `helpers/desktop-fixtures.ts`, on a clock frozen at
 * 15 October 2026: 725 members (604 active, 100 overdue, 35 due this week),
 * the §28 stress names, the 1,000,000 plan and a long discounted member. The
 * screens' API calls are answered from it; only `/api/auth/profile` reaches the
 * dev server, because the shell is rendered from the signed-in gym.
 *
 * These used to be live screenshots of the E2E gym, and live data decays: the
 * nightly crons expired and cancelled the seeded members, until a re-baseline
 * pictured one renewal row where the first had a hundred
 * (release-1.6.2-inverted-check.md R4).
 *
 * ## Reading a failure
 *
 * The data and the clock are fixed, so a diff is one of two things:
 *
 * 1. **Layout moved** — a toolbar wrapped, a column changed width, a control
 *    grew. This is what the spec exists to catch. Fix the regression.
 * 2. **The fixtures changed** — someone edited `desktop-fixtures.ts`, or a
 *    screen started calling an endpoint it does not answer (that fails as
 *    "unstubbed API calls" first). Re-baseline with
 *    `npx playwright test desktop-regression --update-snapshots` and say so in
 *    the PR; never re-baseline a phase's own diff without looking.
 */

import { join } from 'path'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { E2E_ACCESS_CONTROL_ENABLED } from './helpers/access-control'
import {
  DETAIL_MEMBER,
  useDesktopFixtures,
  type Unexpected,
} from './helpers/desktop-fixtures'
import { gotoSettled, openTierPage, type TierPage } from './helpers/tier-page'

test.skip(
  !E2E_ACCESS_CONTROL_ENABLED,
  'requires E2E_ACCESS_CONTROL=1 + a seeded Enterprise gym'
)

/**
 * Nothing drifts any more, so nothing needs absorbing: this is rendering noise
 * only. A 2% tolerance once passed a 16 px shift inside a dialog
 * (member-writes-inverted-check.md I1).
 */
const TOLERANCE = { maxDiffPixelRatio: 0.001 }

const SCREENS = [
  { name: 'dashboard', route: '/dashboard' },
  { name: 'members', route: '/members' },
  { name: 'renewals', route: '/payment-collection' },
  { name: 'revenue', route: '/revenue' },
  { name: 'analytics', route: '/member-analytics' },
  { name: 'settings-gym', route: '/settings/gym' },
] as const

let tier: TierPage
let unexpected: Unexpected

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(600_000)
  tier = await openTierPage(browser, testInfo)
  unexpected = await useDesktopFixtures(tier.page)
})

test.afterEach(() => {
  // A request the fixtures do not answer was aborted, so the screen showed an
  // error state, not the picture the baseline holds.
  expect(unexpected.calls, 'unstubbed API calls').toEqual([])
})

test.afterAll(async () => {
  await tier?.context.close()
})

/** Hides Next's dev-tools badge; the file says why a mask cannot. */
const HIDE_DEV_OVERLAY = join(__dirname, 'helpers', 'hide-dev-overlay.css')

/** Regions that legitimately differ between runs. */
function volatile(page: Page) {
  return [
    // The dashboard header's server clock ("SEP 13 2026, 08:42 IST").
    page.getByText(/ IST$/),
  ]
}

async function stillPointer(page: Page): Promise<void> {
  // Park the pointer so no row or button is in its hover state.
  await page.mouse.move(0, 0)
}

/**
 * Grow the viewport to the whole page and wait for the charts to come to rest.
 *
 * A `fullPage` shot resizes the viewport inside the capture, every chart
 * re-measures, and Recharts restarts its reveal there: the analytics trend was
 * pictured cut off at August while the DOM held the whole line. So the page is
 * made as tall as itself first, and the shot is of the viewport.
 */
async function fitToPage(page: Page): Promise<void> {
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight
  )
  await page.setViewportSize({ width: 1366, height })
  const charts = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.recharts-surface path, .recharts-surface rect'
        ),
      ]
        .map(
          (e) =>
            `${e.getAttribute('d')}${e.getAttribute('width')}${e.getAttribute('height')}`
        )
        .join('|')
    )
  let previous = ''
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(300)
    const now = await charts()
    if (now === previous) return
    previous = now
  }
  throw new Error('the charts never came to rest')
}

for (const screen of SCREENS) {
  test(`${screen.name} matches its 1366 baseline`, async () => {
    const { page } = tier
    await page.setViewportSize({ width: 1366, height: 800 })
    await gotoSettled(page, screen.route)
    await stillPointer(page)
    await fitToPage(page)
    await expect(page).toHaveScreenshot(`${screen.name}.png`, {
      animations: 'disabled',
      caret: 'hide',
      mask: volatile(page),
      stylePath: HIDE_DEV_OVERLAY,
      ...TOLERANCE,
    })
  })
}

test('member detail open matches its 1366 baseline', async () => {
  const { page } = tier
  await page.setViewportSize({ width: 1366, height: 800 })
  await gotoSettled(page, '/members')

  // The long discounted member, so the pictured detail carries both stress
  // strings.
  await page.getByLabel('Search members').fill(DETAIL_MEMBER)
  const row = page.getByRole('row', { name: new RegExp(DETAIL_MEMBER) })
  await expect(row).toBeVisible()
  await row.click()

  const dialog = page.getByRole('dialog', { name: 'Member Details' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(DETAIL_MEMBER)).toBeVisible()
  // The detail loads in two steps (skeleton modal, then content).
  await expect(dialog.locator('.animate-pulse')).toHaveCount(0)
  await stillPointer(page)

  await expect(page).toHaveScreenshot('member-detail.png', {
    animations: 'disabled',
    caret: 'hide',
    mask: volatile(page),
    stylePath: HIDE_DEV_OVERLAY,
    ...TOLERANCE,
  })
})
