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

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use a browser the environment already provides, when it says so.
        // Locked-down CI images ship a Chromium that will not match the exact
        // build this Playwright version wants to download, and `playwright
        // install` is often unavailable there. Unset locally, so the normal
        // managed-browser path is unchanged.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
