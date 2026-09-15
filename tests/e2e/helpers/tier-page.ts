/**
 * One signed-in page per spec file, in the *project's* viewport.
 *
 * The viewport matrix in `playwright.config.ts` runs each mobile-rebuild spec
 * seven times. A sign-in per test at seven widths is ~110 sign-ins a run,
 * which trips Supabase's per-IP token limit (see `helpers/billing.ts` for the
 * two failed attempts at caching sessions). So each spec signs in once in
 * `beforeAll` and drives every route through that page.
 *
 * The catch is that `browser.newPage()` ignores the project's `use` block: it
 * opens a default 1280×720 desktop context whatever project is running, so a
 * "phone-390" run would silently measure a desktop. This helper rebuilds the
 * context from `testInfo.project.use` — viewport, `isMobile`, `hasTouch`,
 * UA, DPR, `baseURL` — so the shared page is the device the project names.
 */

import { expect } from '@playwright/test'
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import { loginAsEnterpriseGym } from './access-control'

export interface TierPage {
  context: BrowserContext
  page: Page
}

/** Open a context matching the running project and sign in the E2E gym. */
export async function openTierPage(
  browser: Browser,
  testInfo: TestInfo
): Promise<TierPage> {
  const use = testInfo.project.use
  const context = await browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport ?? undefined,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    userAgent: use.userAgent,
    deviceScaleFactor: use.deviceScaleFactor,
    colorScheme: use.colorScheme,
  })
  const page = await context.newPage()
  await loginAsEnterpriseGym(page)
  return { context, page }
}

/**
 * Navigate and wait for the screen's data to land.
 *
 * A skeleton passes every probe rule and screenshots as a blank, so "loaded"
 * has to mean the queries resolved: no `Skeleton` (`animate-pulse`) and no
 * spinner (`animate-spin`) left inside `<main>`, after the network has gone
 * quiet. `next dev` compiles a route on first touch, hence the generous
 * budget.
 */
export async function gotoSettled(page: Page, route: string): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState('networkidle').catch(() => {
    // HMR keeps a socket open in dev; the skeleton check below is the real
    // signal, this is only a head start.
  })
  await expect(
    page.locator('main .animate-pulse, main .animate-spin'),
    `${route}: still loading (skeleton or spinner in <main>)`
  ).toHaveCount(0, { timeout: 45_000 })
}
