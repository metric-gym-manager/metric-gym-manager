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
 * The capacity the save test actually wrote, read back by the test after it.
 *
 * Chosen at run time rather than fixed, because Save only enables on a real
 * change and the reader may already be carrying the value from a previous run.
 */
let savedCapacity = '3000'

/**
 * Scope to this spec's own reader.
 *
 * The seeded gym may hold readers registered by the other access-control
 * specs, so every field selector has to be anchored to a row rather than to
 * the page — an unanchored `getByLabel('Fingerprint capacity')` matches one
 * per reader and fails on strict mode the moment a second file has run.
 */
function readerRow(page: Page) {
  // The row root, not the innermost div carrying the serial. The switch,
  // capacity field and Save button are all siblings of the name/serial block,
  // so scoping by serial alone lands inside that block and every control this
  // spec drives falls outside it. The capacity field exists once per row, so
  // requiring it as well pins the scope to the whole row.
  // Anchored on the name, not the serial. `READER.serial` is computed at module
  // load, so it is a different value in every worker process that imports this
  // file — and a row created under one incarnation is then invisible to a
  // locator built from another. The name is a fixed literal and `connectReader`
  // guarantees exactly one row carries it.
  return page
    .locator('div')
    .filter({ hasText: READER.name })
    .filter({ has: page.getByLabel('Fingerprint capacity') })
    .last()
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
  //
  // The full phrase, not just "Connected": a bare string locator matches
  // case-insensitively on a substring, so it also resolved to the empty-state
  // heading "No readers connected" and died on strict mode before ever
  // checking the badge.
  await expect(
    page.getByText('Connected to your access control account')
  ).toBeVisible()
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
  //
  // Deliberately a value the reader does not already hold. Save stays disabled
  // until something actually changes, so re-entering the number already on
  // file leaves the button inert — and the click then waits out the whole test
  // timeout on an element that was never going to enable. A reader carrying a
  // capacity from an earlier run is the normal case here, not the exception.
  const capacityField = row.getByLabel('Fingerprint capacity')
  const current = (await capacityField.inputValue()).trim()
  savedCapacity = current === '3000' ? '2500' : '3000'

  await capacityField.fill(savedCapacity)

  // Fails here, clearly, if hydration has not attached the change handler yet:
  // the field would hold the new text while React still had the old value, and
  // the only symptom otherwise is a Save button that never enables.
  const save = row.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeEnabled()

  // Wait for the PATCH to land, not just for the click. The assertion below
  // passes the instant it is evaluated — the switch is already checked — so
  // without this the test ends and tears the page down while the save is still
  // in flight. The request is aborted mid-body (the server logs "Unexpected
  // end of JSON input"), the capacity is never written, and the failure
  // surfaces one test later as a value that did not persist.
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/access-control/devices/') &&
      response.request().method() === 'PATCH'
  )
  await save.click()
  await saved

  // Rule 2.5, asserted where it actually bites. The card does offer an in-use
  // toggle — and should, since enable and disable have endpoints of their own
  // — but the PATCH behind Save handles name and capacity only. A property
  // edit that flipped state as a side effect would pause a door, and nobody
  // would connect the two.
  await expect(inUse).toBeChecked()
})

test('persists the capacity it was given', async ({ page }) => {
  await page.goto('/settings/access-control')

  // Whatever the test above actually saved, not a hardcoded number — it picks
  // a value the reader was not already carrying, so the two must agree through
  // this variable. `mode: 'serial'` is what makes that ordering dependable.
  await expect(readerRow(page).getByLabel('Fingerprint capacity')).toHaveValue(
    savedCapacity
  )
})
