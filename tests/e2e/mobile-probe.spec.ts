/**
 * E2E: the mobile probe over every workspace route, at every viewport in the
 * matrix (mobile rebuild plan §17, §19 gate 4, §24 "Mobile quality").
 *
 * What fails and what only reports:
 *
 * - **Desktop tier (≥ 768)** — every rule must be clean. The desktop is not
 *   being rebuilt, so any violation here is a regression the rebuild
 *   introduced, or a pre-existing defect worth knowing about today.
 * - **Phone tier (< 768)** — a route is asserted only once it is in
 *   {@link STRICT_PHONE_ROUTES}; every other route is *reported*: the
 *   violations are attached to the test and printed, never failed. Phase 0
 *   ships this list empty on purpose — the audit measured every phone route
 *   failing (767 px tables, a 754 px bottom bar, 26 px buttons), and a
 *   red-everywhere suite teaches people to ignore red. Each phase adds the
 *   routes it rebuilt, and the list only grows.
 *
 * The report is the point in Phase 0: run it before and after a phase and the
 * numbers must fall on the touched routes and hold everywhere else.
 *
 * **Desktop baseline.** The desktop was expected to probe clean and did not:
 * the six-digit LKR ticks on the dashboard and revenue charts are cut to
 * "0000"/"5000" at 1366 (`YAxis width={40}`, plan §5.9 — rendered and
 * confirmed, not inferred), and the analytics x-axis end label overshoots by
 * a pixel. Phase 0 may not touch product code, so these are pinned in
 * {@link KNOWN_DESKTOP_VIOLATIONS} the way UI1–UI5 pin theirs: every
 * violation must match an entry, and every entry must still match a
 * violation, so a fix has to delete its line in the same commit and the list
 * can only shrink.
 */

import { test, expect } from '@playwright/test'
import { E2E_ACCESS_CONTROL_ENABLED } from './helpers/access-control'
import {
  probePage,
  probeSummary,
  probeViolations,
} from './helpers/mobile-probe'
import { ensureStressFixtures } from './helpers/stress-fixtures'
import { gotoSettled, openTierPage, type TierPage } from './helpers/tier-page'

test.skip(
  !E2E_ACCESS_CONTROL_ENABLED,
  'requires E2E_ACCESS_CONTROL=1 + a seeded Enterprise gym'
)

/** Every `(dashboard)` route the audit inventoried (§C.1). */
export const WORKSPACE_ROUTES = [
  '/dashboard',
  '/members',
  '/payment-collection',
  '/revenue',
  '/member-analytics',
  '/make-announcement',
  '/billing-setup',
  '/settings',
  '/settings/gym',
  '/settings/registration',
  '/settings/policies',
  '/settings/security',
  '/settings/access-control',
  '/settings/billing',
  '/support',
  '/access-control',
] as const

/**
 * Phone routes whose probe must be clean. Grows by phase; never shrinks.
 *
 * Phase 0: none — see the file header.
 */
export const STRICT_PHONE_ROUTES: ReadonlyArray<
  (typeof WORKSPACE_ROUTES)[number]
> = []

/**
 * Desktop-tier violations that exist today, as patterns over the probe's
 * violation lines. Pixel values are left out of the patterns on purpose —
 * a tick clipped by 12 px one day and 11 px the next is the same defect.
 *
 * Each entry names the phase expected to clear it. Remove the line with the
 * fix; the ratchet below fails on a stale entry.
 */
export const KNOWN_DESKTOP_VIOLATIONS: ReadonlyArray<{
  route: (typeof WORKSPACE_ROUTES)[number]
  pattern: RegExp
  clears: string
}> = [
  // Phase 1 (§5.9 `compactAxis` / `yTickFormatter`): 6-digit ticks do not fit
  // a 40 px axis at any width. Visible as "0000 / 5000 / 0000 / 5000 / 0".
  {
    route: '/dashboard',
    pattern: /axis tick "\d{5,}" clipped/,
    clears: 'Phase 1',
  },
  {
    route: '/revenue',
    pattern: /axis tick "\d{5,}" clipped/,
    clears: 'Phase 1',
  },
  // Phase 7: the trailing x-axis label overshoots the chart by a pixel.
  {
    route: '/member-analytics',
    pattern: /axis tick "[A-Z][a-z]{2} \d{2}" clipped by -?1px/,
    clears: 'Phase 7',
  },
]

/**
 * Apply the desktop baseline: returns the violations that are *not* known,
 * plus the known entries that no longer occur (a stale entry hides a fix
 * nobody recorded, exactly like a stale `UI1_ALLOW` line).
 */
export function unexplained(
  violations: string[],
  route: string
): { unknown: string[]; stale: string[] } {
  const mine = KNOWN_DESKTOP_VIOLATIONS.filter((k) => k.route === route)
  const unknown = violations.filter((v) => !mine.some((k) => k.pattern.test(v)))
  const stale = mine
    .filter((k) => !violations.some((v) => k.pattern.test(v)))
    .map(
      (k) =>
        `${k.route} ${k.pattern} (clears: ${k.clears}) no longer occurs — delete it`
    )
  return { unknown, stale }
}

let tier: TierPage

test.beforeAll(async ({ browser }, testInfo) => {
  // The first seed registers 300 members; every later call is a few GETs.
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

for (const route of WORKSPACE_ROUTES) {
  test(`probe ${route}`, async ({}, testInfo) => {
    const { page } = tier
    await gotoSettled(page, route)

    const report = await probePage(page, route)
    const violations = probeViolations(report)

    await testInfo.attach(`probe${route.replace(/\//g, '-')}.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    })
    testInfo.annotations.push({
      type: 'probe',
      description: probeSummary(report),
    })

    if (report.tier === 'desktop') {
      const { unknown, stale } = unexplained(violations, route)
      expect(unknown, probeSummary(report)).toEqual([])
      expect(stale, 'KNOWN_DESKTOP_VIOLATIONS must shrink').toEqual([])
    } else if (STRICT_PHONE_ROUTES.includes(route)) {
      expect(violations, probeSummary(report)).toEqual([])
    } else {
      // Report only (Phase 0). Printed so a plain `playwright test` run shows
      // the phone numbers without opening the HTML report.
      console.log(probeSummary(report))
    }
  })
}
