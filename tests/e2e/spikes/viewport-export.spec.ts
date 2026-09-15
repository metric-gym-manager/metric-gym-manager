/**
 * VERIFY spike (b), mobile rebuild plan §16: the shape of the Next 16
 * `viewport` export, and what the document ships today.
 *
 * Findings, from `node_modules/next/dist/`:
 *
 * - `import type { Viewport } from 'next'` carries exactly the fields §16
 *   assumes: `width`, `initialScale`, `viewportFit: 'auto' | 'cover' |
 *   'contain'`, `themeColor` (string or `{ media, color }[]`), plus
 *   `userScalable`, `maximumScale`, `interactiveWidget`, `colorScheme`
 *   (`lib/metadata/types/extra-types.d.ts`).
 * - `lib/metadata/metadata.js` renders the layout fields into one
 *   `<meta name="viewport">` in the fixed order `width, height,
 *   initial-scale, minimum-scale, maximum-scale, user-scalable,
 *   viewport-fit, interactive-widget`, and `themeColor` as its own
 *   `<meta name="theme-color">` (one per media entry).
 * - The export is server-component only and exclusive with
 *   `generateViewport` (`docs/01-app/03-api-reference/04-functions/
 *   generate-viewport.md`). `src/app/layout.tsx` is a server component with
 *   no `viewport` export today, so the static object form applies.
 * - **Trap:** the root layout already emits `theme-color` through
 *   `metadata.other['theme-color'] = '#000000'`. Adding `viewport.themeColor`
 *   without removing that entry ships two `theme-color` tags with different
 *   values. The assertion below pins "exactly one" so Phase 1 cannot miss it.
 *
 * The typed constant is the §16 export verbatim; `tsc` checks it against
 * Next's own type on every run, so a future Next upgrade that renames a
 * field fails here before it fails in the layout.
 */

import { test, expect } from '@playwright/test'
import type { Viewport } from 'next'
import { E2E_ACCESS_CONTROL_ENABLED } from '../helpers/access-control'
import { gotoSettled, openTierPage, type TierPage } from '../helpers/tier-page'

test.skip(
  !E2E_ACCESS_CONTROL_ENABLED,
  'requires E2E_ACCESS_CONTROL=1 + a seeded Enterprise gym'
)

/** Plan §16, as Phase 1 will write it into `src/app/layout.tsx`. */
export const PLANNED_VIEWPORT: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#08080a',
}

/** What Next will render for {@link PLANNED_VIEWPORT} (metadata.js order). */
export const PLANNED_VIEWPORT_META =
  'width=device-width, initial-scale=1, viewport-fit=cover'

let tier: TierPage

test.beforeAll(async ({ browser }, testInfo) => {
  tier = await openTierPage(browser, testInfo)
})

test.afterAll(async () => {
  await tier?.context.close()
})

test('recorded: the document ships Next’s default viewport and one theme-color today', async ({}, testInfo) => {
  const { page } = tier
  await gotoSettled(page, '/dashboard')

  const head = await page.evaluate(() => ({
    viewport: Array.from(
      document.querySelectorAll('meta[name="viewport"]'),
      (m) => m.getAttribute('content')
    ),
    themeColor: Array.from(
      document.querySelectorAll('meta[name="theme-color"]'),
      (m) => m.getAttribute('content')
    ),
  }))

  testInfo.annotations.push({
    type: 'spike',
    description: `viewport=${JSON.stringify(head.viewport)} theme-color=${JSON.stringify(head.themeColor)}`,
  })

  // Phase 0: no `viewport` export yet, so this is Next's default. Phase 1
  // flips it to PLANNED_VIEWPORT_META.
  expect(head.viewport).toEqual(['width=device-width, initial-scale=1'])
  expect(head.viewport[0]).not.toContain('viewport-fit')

  // Exactly one theme-color, whatever its value. Two would mean
  // `viewport.themeColor` was added beside `metadata.other['theme-color']`.
  expect(head.themeColor).toHaveLength(1)
})
