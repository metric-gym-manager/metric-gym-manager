import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

/**
 * Load `.env.local` into the test process.
 *
 * Next.js loads it for the *app*, but Playwright's own process never saw it —
 * so every spec gated on an env var (`E2E_BILLING`, `E2E_ACCESS_CONTROL`)
 * silently skipped even with the file present and correct. A suite that skips
 * reports green, which is the failure mode worth removing: the run looked like
 * it passed.
 *
 * `loadEnvConfig` is Next's own loader, so the tests see exactly the values the
 * dev server does — no second copy of the precedence rules to drift.
 */
loadEnvConfig(process.cwd())

/**
 * Port the E2E dev server runs on.
 *
 * Deliberately not 3000. `reuseExistingServer` treats *anything* answering on
 * the configured port as "the app is already up" — it does not check that the
 * thing answering is ours. A Remotion studio on 3000 was silently adopted as
 * the app under test, and every spec then failed on a page that could not
 * exist, with no hint that the server was a different program entirely.
 *
 * A dedicated port makes that collision unlikely; `E2E_PORT` overrides it when
 * even this one is taken.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = `http://localhost:${PORT}`

/**
 * Browser executable override, shared by every project.
 *
 * Locked-down CI images ship a Chromium that will not match the exact build
 * this Playwright version wants to download, and `playwright install` is
 * often unavailable there. Unset locally, so the normal managed-browser path
 * is unchanged.
 */
const launch = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
  : {}

/**
 * The mobile-rebuild viewport matrix (plan §4, §17).
 *
 * Seven widths, one boundary: `< 768` is the phone tier, `≥ 768` the desktop
 * tier. The phone projects emulate a phone properly — `isMobile` (so the
 * viewport meta and `sec-ch-ua-mobile: ?1` behave as on a device), `hasTouch`,
 * an iPhone UA, DPR 2–3 — because a desktop Chromium merely resized to 390 px
 * is not what a gym owner holds. 768×1024 is an iPad in portrait: touch, but
 * a desktop-class UA and `isMobile: false`, which is what iPadOS Safari
 * reports and what the plan's tablet decision (d02) expects to receive.
 * 1024/1366 are plain desktops; 1366 is the screenshot-baseline width.
 *
 * Only the mobile-rebuild specs (`mobile-*.spec.ts`) run across the matrix.
 * `desktop-regression.spec.ts` runs at 1366 only, the spikes at 390 only.
 */
const VIEWPORT_SPECS = /mobile-.*\.spec\.ts$/
const DESKTOP_REGRESSION_SPEC = /desktop-regression\.spec\.ts$/
const SPIKE_SPECS = /spikes\/.*\.spec\.ts$/

const IPHONE_UA = devices['iPhone 13'].userAgent

const phone = (width: number, height: number, deviceScaleFactor: number) => ({
  browserName: 'chromium' as const,
  viewport: { width, height },
  deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
  userAgent: IPHONE_UA,
  ...launch,
})

const desktop = (width: number, height: number) => ({
  ...devices['Desktop Chrome'],
  viewport: { width, height },
  ...launch,
})

const VIEWPORT_PROJECTS = [
  { name: 'phone-320', use: phone(320, 568, 2), testMatch: [VIEWPORT_SPECS] },
  { name: 'phone-360', use: phone(360, 800, 3), testMatch: [VIEWPORT_SPECS] },
  {
    name: 'phone-390',
    use: phone(390, 844, 3),
    testMatch: [VIEWPORT_SPECS, SPIKE_SPECS],
  },
  { name: 'phone-430', use: phone(430, 932, 3), testMatch: [VIEWPORT_SPECS] },
  {
    name: 'tablet-768',
    use: { ...desktop(768, 1024), hasTouch: true, deviceScaleFactor: 2 },
    testMatch: [VIEWPORT_SPECS],
  },
  {
    name: 'desktop-1024',
    use: desktop(1024, 768),
    testMatch: [VIEWPORT_SPECS],
  },
  {
    name: 'desktop-1366',
    use: desktop(1366, 800),
    testMatch: [VIEWPORT_SPECS, DESKTOP_REGRESSION_SPEC],
  },
]

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  /**
   * One worker, everywhere — not only in CI.
   *
   * Every spec in this directory drives the *same* seeded gym: the billing
   * specs share one gym manager, and all three access-control specs share one
   * Enterprise gym. Parallel files therefore mutate each other's state rather
   * than running in isolation — three specs each register a reader and every
   * page-wide locator then resolves to one match per reader and dies on strict
   * mode, which reads as a broken selector rather than as cross-talk. Real
   * isolation would need a gym per worker, which is a seeding change, not a
   * config one. Until then this is the setting that makes the suite mean
   * anything.
   */
  workers: 1,

  /**
   * Well above Playwright's 30s default, because the server under test is
   * `next dev`: the first touch of a route compiles it on demand, and a login
   * that has to wait for that can eat the whole default budget before the
   * helper it is inside gets to report anything useful.
   */
  timeout: 120_000,

  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      // The pre-rebuild suite (billing, access control) runs once, on the
      // desktop it was written for. The viewport matrix below is for the
      // mobile-rebuild specs only; running twenty sign-ins per viewport would
      // trip Supabase's per-IP token limit (see helpers/billing.ts).
      testIgnore: [VIEWPORT_SPECS, DESKTOP_REGRESSION_SPEC, SPIKE_SPECS],
      use: { ...devices['Desktop Chrome'], ...launch },
    },
    ...VIEWPORT_PROJECTS,
  ],
  webServer: {
    command: 'npm run dev',
    // PORT rather than a --port argument: `npm run dev` chains pwa:generate
    // before `next dev`, so appended args are fragile. Next reads PORT.
    env: { PORT: String(PORT) },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
})
