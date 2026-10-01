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
 * **All sixteen, as of Phase 10 (MO-2).** Phases 1–9 each left this empty and
 * said why: every phase's measurement was taken against intercepted endpoints
 * on throwaway `/pN-probe/*` routes, because no session in the rebuild had
 * Supabase credentials, and a route asserted strict here is asserted against
 * the SEEDED gym this list's own suite requires. Promising on one body of
 * evidence what a different one will check is how a ratchet starts lying.
 *
 * What makes the promotion defensible now rather than then is coverage, not a
 * new kind of evidence: Phase 10 probed fifteen of these sixteen at 320, 360,
 * 390 and 430 — sixty states, zero violations, zero console errors, with §28
 * content at magnitudes each field's own producer can emit — and the sixteenth
 * (`/settings`) renders `null` by design and is measured through the shell.
 * A route that is clean on every phone width with a full fixture and dirty on
 * the seeded gym is a DATA difference worth a failure, which is exactly what
 * this list is for.
 *
 * First run against the seeded gym is therefore the real test of this line.
 * If it fails, the fix is the screen or the fixture — never a deletion here.
 */
export const STRICT_PHONE_ROUTES: ReadonlyArray<
  (typeof WORKSPACE_ROUTES)[number]
> = WORKSPACE_ROUTES

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
  // EMPTY — all three entries cleared at Phase 10, the phase that owns the
  // desktop baselines. The list may only shrink; an entry added here needs a
  // written reason and a named clearing phase.
  //
  // **The two y-tick entries were FIXED.** `compactAxis` now ships on both
  // tiers for `/dashboard` and `/revenue`. Phases 1 and 6 scoped it to the
  // phone because it changes the tick TEXT and so moves the committed 1366
  // baselines, which MO-4 forbids a screen phase from absorbing; this phase
  // owns them. Re-measured after the change: clean at 768, 1024 and 1366,
  // where `250000`/`500000`/`750000` had each been cut by 12 px and
  // `1000000` by 18. **`dashboard-desktop-1366` and `revenue-desktop-1366`
  // still carry the OLD axis and must be re-taken with `--update-snapshots`
  // on a machine with the seeded gym** — stated in the closeout rather than
  // absorbed here, because this environment has no Supabase credentials and a
  // baseline taken against intercepted fixtures would be a different picture
  // of a different screen.
  //
  // **The `/member-analytics` entry was DELETED, not fixed**, because its
  // condition does not exist. F37 probed the rebuilt screen at all seven
  // widths with the labels the product's own `bucketLabel` emits and found
  // the trailing tick whole at every one; this phase's sweep reproduces that.
  // The ratchet's own rule is that an entry must still match a violation, and
  // a pattern that matches nothing is the stale entry the rule exists to
  // catch. The sibling case F37 found — a 0.6 px overhang at DAY granularity,
  // width-independent and therefore chart geometry — is NOT this entry and
  // needs a probe that drives the range control before measuring; it is
  // carried as MO-30, not as a pattern no run can reach.
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
