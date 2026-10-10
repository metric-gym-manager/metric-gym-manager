/**
 * E2E: /access-control — the daily operations dashboard.
 *
 * The screen exists to answer three questions at a glance: is a door working,
 * is one filling up, and who came in. Its defining property is that it must not
 * cry wolf — it is the screen built to prevent false alarms, so a false alarm
 * on it is worse than on any other page.
 *
 * Two assertions carry most of the value:
 *
 *  - **A reader we have never heard from reads "No contact yet", not "Not
 *    responding".** Presence has three states and `unknown` is not `offline`
 *    (trap 9). Collapsing them puts a permanent red flag next to every reader
 *    a gym has just registered, and staff who learn to ignore one alarm ignore
 *    the next one too.
 *  - **No vendor return code reaches this page.** Raw hardware detail is
 *    SaaS-admin only (rule 2.9). Asserted against the rendered text rather
 *    than component by component, because the leak that matters is whichever
 *    one nobody thought to check.
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

test.describe.configure({ mode: 'serial' })

const READER = { serial: uniqueSerial('DASH'), name: 'Dashboard Spec Reader' }

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await loginAsEnterpriseGym(page)
  await ensureVendorAccount(page)
  await connectReader(page, READER)
  await page.close()
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await loginAsEnterpriseGym(page)
  await forgetReader(page, READER.name)
  await page.close()
})

test.beforeEach(async ({ page }) => {
  await loginAsEnterpriseGym(page)
  await page.goto('/access-control')
})

/**
 * This spec's own reader card.
 *
 * Two things force the scoping. The presence badge is a *sibling* of the name
 * inside the card header, so `filter({ hasText })...last()` alone resolves to
 * the innermost div holding the name and excludes the badge — reporting it
 * absent from a page where it is plainly rendered. And the seeded gym is
 * shared by all three access-control specs, so the dashboard genuinely lists
 * several readers: anything asserted page-wide resolves to one match per card
 * and dies on strict mode. Anchoring on a second element that only the card
 * root contains pins the scope to this reader.
 */
function readerCard(page: Page) {
  return page
    .locator('div')
    .filter({ hasText: READER.name })
    .filter({ has: page.getByText('Members on this reader') })
    .last()
}

test('shows a never-contacted reader as unknown, not offline', async ({
  page,
}) => {
  const card = readerCard(page)

  // "No contact yet" is neutral. "Not responding" is a warning. A reader
  // registered a minute ago has told us nothing, which is an absence of
  // information rather than a fault — and the difference is the whole point
  // of this screen.
  await expect(card.getByText('No contact yet')).toBeVisible()
  await expect(page.getByText('Not responding')).toHaveCount(0)
})

test('offers remote unlock to any entitled user', async ({ page }) => {
  // The settled decision (§7.1.2): front-desk staff may open a door. A gym is
  // one Supabase user, so there is no role to restrict this to, and the
  // control is audit — the actor on the job plus the reader's own event 8 —
  // never permission. Asserted through the real page rather than a mocked
  // component, so a wrapper that quietly stops passing it is caught here.
  await expect(
    readerCard(page).getByRole('button', { name: /open door/i })
  ).toBeVisible()
})

test('hides the capacity bar until a capacity is known', async ({ page }) => {
  // Capacity is unknown until a reader tells us, by refusing an enrolment.
  // Guessing would evict members from a reader with plenty of room, so the
  // bar shows nothing rather than something invented.
  await expect(
    page.getByRole('progressbar', { name: new RegExp(READER.name, 'i') })
  ).toHaveCount(0)
})

test('filters the activity log server-side', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: 'Recent activity' })
  ).toBeVisible()

  const request = page.waitForRequest(
    (r) =>
      r.url().includes('/api/access-control/events') &&
      r.url().includes('kind=')
  )

  await page.getByRole('button', { name: 'Refusals', exact: true }).click()

  // The filter has to reach SQL, not slice an already-fetched page: "Other" is
  // defined by absence and has no code list, which is why the four filterable
  // kinds are the only ones offered.
  await request
})

test('never renders a vendor return code', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Readers' })).toBeVisible()

  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')

  // Return codes are negative integers ("-18" is a full terminal). A gym
  // manager gets plain language and "try again"; the code lives on the
  // SaaS-admin health view where someone can act on it.
  expect(text).not.toMatch(/\breturn code\b/i)
  expect(text).not.toMatch(/(^|\s)-\d{1,4}(\s|$)/)
})
