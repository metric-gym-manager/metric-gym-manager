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

  // Long enough for `next dev` to compile this route on first touch. At the
  // 5s default the settings page is still building and the heading reads as
  // missing, which looks like a renamed selector rather than a slow server.
  const heading = page.getByRole('heading', { name: 'Access Control Account' })
  await expect(heading).toBeVisible({ timeout: 30_000 })

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
  // Serials are unique per run (`uniqueSerial`) but names are fixed per spec,
  // so a run that died before its cleanup leaves a reader behind that the next
  // run cannot tell apart from the one it is about to create: two rows with
  // identical text, and every name-based locator dies on strict mode. Setup
  // has to be idempotent, because the run that litters is by definition the
  // run that failed.
  await forgetReader(page, reader.name)

  await page.goto('/settings/access-control')

  await page.getByRole('button', { name: 'Connect a reader' }).click()

  // Scoped by placeholder, not by label. The add form is an inline panel
  // rather than a dialog, and every reader already in the list renders its own
  // "Name" field — so `getByLabel('Name')` matches the form plus one per row,
  // and dies on strict mode as soon as the gym has a single reader. The
  // placeholders exist only in the add form. "Serial number" happens to be
  // unambiguous today, but it is scoped the same way so the pair cannot drift.
  await page.getByPlaceholder('QEM1253800017').fill(reader.serial)
  await page.getByPlaceholder('Front entrance').fill(reader.name)
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

  // Wait for the reader list to settle before counting anything. It renders a
  // skeleton first, and while it does every count is 0 — which makes "nothing
  // to forget" and "not loaded yet" the same answer. The drain below would
  // then do nothing, the assertion at the end would pass against a list that
  // had not rendered, and the reader would still be there for the next run.
  await expect(
    page
      .getByRole('button', { name: /^Forget / })
      .or(page.getByText('No readers connected'))
      .first()
  ).toBeVisible({ timeout: 30_000 })

  const forget = page.getByRole('button', { name: `Forget ${name}` })

  // Drain rather than remove one. Earlier failed runs can leave several rows
  // sharing a name, and `forget.click()` on a locator matching more than one
  // is itself a strict-mode failure — so the cleanup helper would break on
  // exactly the mess it exists to clear. Bounded so a row that refuses to go
  // fails as a timeout on the assertion below rather than spinning forever.
  const dialog = page.getByRole('dialog')

  for (let remaining = await forget.count(); remaining > 0; remaining--) {
    // Re-click until the dialog is actually open, rather than clicking once and
    // trusting it. The settle gate above waits for the trigger to be *visible*,
    // which in dev is not the same as hydrated — an early click is swallowed
    // with no handler attached and nothing to retry it.
    await expect(async () => {
      await forget.first().click()
      await expect(dialog).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })

    // Scoped to the dialog, and matched on its exact label.
    //
    // The page-wide `/forget|remove|confirm/i` this replaces also matched every
    // row's `aria-label="Forget <name>"` trigger — three decoys on the shared
    // gym — so `.last()` only found the confirm button once the Radix portal
    // had mounted. Resolve it a tick earlier and `.last()` was the *last row's*
    // trigger: the helper opened a second reader's dialog, the one it meant to
    // remove survived, and the count assertion failed with the reader still
    // listed. That was the intermittent cleanup failure, and it got likelier
    // with every extra reader on the page.
    await dialog.getByRole('button', { name: 'Forget reader' }).click()

    // Gone from the DOM before the next iteration clicks another trigger — a
    // modal overlay would otherwise intercept it.
    await expect(dialog).toBeHidden()
    await expect(forget).toHaveCount(remaining - 1)
  }

  await expect(page.getByText(name)).toHaveCount(0)
}
