/**
 * E2E: /settings/access-control — the setup half of the feature.
 *
 * This is the screen an installer and an owner use once. What matters about it
 * is not that the forms work but that two specific things stay true no matter
 * how the UI is rearranged:
 *
 *  - **Credentials are write-only.** They are never read back, not even to the
 *    owner who typed them. One vendor credential reaches every gym on a shared
 *    account, so a password rendered into a page is a password in a browser
 *    cache, a screenshot and a support ticket.
 *  - **Editing a reader cannot change its state.** The card does offer an
 *    in-use toggle, and should — enable and disable have endpoints of their
 *    own (rule 2.5). What must stay true is that the PATCH behind *Save*
 *    handles name and capacity only. A property edit that paused a door as a
 *    side effect is a failure nobody would connect back to a rename.
 *
 * Runs against `MockAccessControlProvider` — no hardware, no vendor.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  E2E_ACCESS_CONTROL_ENABLED,
  connectReader,
  ensureVendorAccount,
  forgetReader,
  loginAsEnterpriseGym,
  uniqueSerial,
} from './helpers/access-control'

test.skip(
  !E2E_ACCESS_CONTROL_ENABLED,
  'requires E2E_ACCESS_CONTROL=1 + a seeded Enterprise gym'
)

// Each test mutates the same gym's readers, so they must not interleave.
test.describe.configure({ mode: 'serial' })

const READER = { serial: uniqueSerial('SETUP'), name: 'Setup Spec Reader' }

/**
 * Scope to this spec's own reader.
 *
 * The seeded gym may hold readers registered by the other access-control
 * specs, so every field selector has to be anchored to a row rather than to
 * the page — an unanchored `getByLabel('Fingerprint capacity')` matches one
 * per reader and fails on strict mode the moment a second file has run.
 */
function readerRow(page: Page) {
  return page.locator('div').filter({ hasText: READER.serial }).last()
}

test.beforeEach(async ({ page }) => {
  await loginAsEnterpriseGym(page)
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await loginAsEnterpriseGym(page)
  await forgetReader(page, READER.name)
  await page.close()
})

test('saves vendor credentials and never reads them back', async ({ page }) => {
  const password = 'not-a-real-secret'

  await ensureVendorAccount(page)
  await page.reload()

  await expect(
    page.getByRole('heading', { name: 'Access Control Account' })
  ).toBeVisible()

  // The whole assertion: after a round trip the password is nowhere — not in
  // the input's value, not in the markup, not in a hydration payload.
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  expect(await page.content()).not.toContain(password)
})

test('reports the connection state after a probe', async ({ page }) => {
  await ensureVendorAccount(page)

  await page.getByRole('button', { name: 'Test connection' }).click()

  // The mock accepts any credentials, so this is the success path. What is
  // being checked is that the probe result reaches the badge at all — an
  // account that has never been verified must not read as connected.
  await expect(page.getByText('Connected')).toBeVisible()
})

test('connects a reader by serial', async ({ page }) => {
  await ensureVendorAccount(page)
  await connectReader(page, READER)

  await expect(page.getByText(READER.name)).toBeVisible()
})

test('saving name or capacity never changes whether the reader is in use', async ({
  page,
}) => {
  await page.goto('/settings/access-control')

  const row = readerRow(page)
  const inUse = row.getByRole('switch', {
    name: `Send changes to ${READER.name}`,
  })

  await expect(inUse).toBeChecked()

  // Capacity is normally learned the hard way, from a reader answering "-18"
  // when it is full. That only happens once a gym has already filled one, so
  // without manual entry the capacity bar shows nothing and the proactive
  // eviction sweep cannot fire at all on day one (B3).
  await row.getByLabel('Fingerprint capacity').fill('3000')
  await row.getByRole('button', { name: 'Save', exact: true }).click()

  // Rule 2.5, asserted where it actually bites. The card does offer an in-use
  // toggle — and should, since enable and disable have endpoints of their own
  // — but the PATCH behind Save handles name and capacity only. A property
  // edit that flipped state as a side effect would pause a door, and nobody
  // would connect the two.
  await expect(inUse).toBeChecked()
})

test('persists the capacity it was given', async ({ page }) => {
  await page.goto('/settings/access-control')

  await expect(readerRow(page).getByLabel('Fingerprint capacity')).toHaveValue(
    '3000'
  )
})
