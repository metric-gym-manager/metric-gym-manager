/**
 * E2E helpers for the access-control screens.
 *
 * ## Why these can run with no hardware and no vendor
 *
 * `createAccessControlProvider()` returns `MockAccessControlProvider` unless
 * `ACCESS_CONTROL_ENABLED=true`. The mock answers every call successfully and
 * records what it was asked, so setup, the operations dashboard and the member
 * panel are all driveable end to end against a plain dev server. Leave
 * `ACCESS_CONTROL_ENABLED` unset — these specs assume the mock.
 *
 * ## What the mock's lifetime means for what can be asserted
 *
 * The factory returns a **new** mock per call, so nothing it holds in memory
 * survives one HTTP request. Two consequences shape every spec here:
 *
 *  - `listDevices` always answers empty, so a registered reader is never
 *    marked seen and stays at `unknown` presence. That is not a limitation —
 *    it is exactly the state worth asserting (a reader we have never heard
 *    from must read "No contact yet", never "Not responding").
 *  - `listSubjects` always answers empty, so enrolment detection can never
 *    flip `finger_enrolled`. The "Fingerprint registered" state is therefore
 *    **unreachable from E2E** and is deliberately not asserted; it stays
 *    covered by `useEnrolmentPoll.test.tsx` and the `DetectBiometricEnrolment`
 *    unit tests. Reaching it here would need either global mock state — shared
 *    across the whole unit suite — or a test backdoor in the app, and both are
 *    worse than the coverage gained.
 *
 * ## Requirements (every spec skips without them)
 *
 *   E2E_ACCESS_CONTROL=1
 *   E2E_ENTERPRISE_GYM_EMAIL / E2E_ENTERPRISE_GYM_PASSWORD
 *     — a seeded gym on the Enterprise tier. `requireAccessControlGym` fails
 *       closed, so a Lite gym gets 403 on every endpoint behind these screens.
 *
 * Optional, for the not-entitled case only:
 *
 *   E2E_LITE_GYM_EMAIL / E2E_LITE_GYM_PASSWORD
 */

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { loginAsGym } from './billing'

export const E2E_ACCESS_CONTROL_ENABLED = process.env.E2E_ACCESS_CONTROL === '1'

export const E2E_LITE_GYM_CONFIGURED = Boolean(
  process.env.E2E_LITE_GYM_EMAIL && process.env.E2E_LITE_GYM_PASSWORD
)

/** Log in as the seeded Enterprise gym — the only tier these screens serve. */
export async function loginAsEnterpriseGym(page: Page): Promise<void> {
  await loginAsGym(page, {
    email: process.env.E2E_ENTERPRISE_GYM_EMAIL,
    password: process.env.E2E_ENTERPRISE_GYM_PASSWORD,
  })
}

/** Log in as a seeded gym without the hardware capability. */
export async function loginAsLiteGym(page: Page): Promise<void> {
  await loginAsGym(page, {
    email: process.env.E2E_LITE_GYM_EMAIL,
    password: process.env.E2E_LITE_GYM_PASSWORD,
  })
}

/**
 * A serial no other spec will use.
 *
 * Playwright runs files in parallel by default and every spec here mutates the
 * same gym's readers. Colliding on a serial would surface as a flake in
 * whichever spec lost the race, so each one registers its own.
 */
export function uniqueSerial(prefix: string): string {
  return `${prefix}${Date.now().toString().slice(-8)}`
}

/**
 * Make sure the gym has vendor credentials saved.
 *
 * Idempotent — the route upserts — so specs can call it freely without
 * ordering assumptions between files. The values are nonsense on purpose:
 * the mock provider accepts anything, and a real address here would be a
 * credential in a repo.
 */
export async function ensureVendorAccount(page: Page): Promise<void> {
  await page.goto('/settings/access-control')

  const heading = page.getByRole('heading', { name: 'Access Control Account' })
  await expect(heading).toBeVisible()

  await page.getByLabel('Server address').fill('https://vft.example.com')
  await page.getByLabel('Email', { exact: true }).fill('installer@example.com')
  await page.getByLabel('Password', { exact: true }).fill('not-a-real-secret')

  await page.getByRole('button', { name: /(Save|Update) and connect/ }).click()

  // The badge is the account existing at all; verification is a separate probe.
  await expect(page.getByText(/Connected|Not verified/)).toBeVisible()
}

/** Register a reader and wait for it to appear in the list. */
export async function connectReader(
  page: Page,
  reader: { serial: string; name: string }
): Promise<void> {
  await page.goto('/settings/access-control')

  await page.getByRole('button', { name: 'Connect a reader' }).click()
  await page.getByLabel('Serial number').fill(reader.serial)
  await page.getByLabel('Name', { exact: true }).fill(reader.name)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()

  await expect(page.getByText(reader.name)).toBeVisible()
}

/**
 * Remove a reader from our records.
 *
 * Named "forget" rather than "delete" because that is what it is: the vendor
 * keeps the terminal and its templates, so registering the same serial again
 * restores it. Specs clean up after themselves so a failed run does not leave
 * the seeded gym littered with readers.
 */
export async function forgetReader(page: Page, name: string): Promise<void> {
  await page.goto('/settings/access-control')

  const forget = page.getByRole('button', { name: `Forget ${name}` })
  if ((await forget.count()) === 0) return

  await forget.click()
  await page
    .getByRole('button', { name: /forget|remove|confirm/i })
    .last()
    .click()
  await expect(page.getByText(name)).toHaveCount(0)
}
