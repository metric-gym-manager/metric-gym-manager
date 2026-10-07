/**
 * E2E: the per-member door-access panel, inside the member modal.
 *
 * This panel answers "why can't Nimal get in?" while someone is looking at
 * Nimal, usually with Nimal standing there. It is also where a fingerprint
 * gets taken, which makes it the one screen in the product that collects
 * sensitive personal data.
 *
 * So the assertion that matters most here is the consent gate: the button that
 * causes a fingerprint to be recorded must not fire until the member has
 * agreed, and the agreement must be visible afterwards. The server refuses
 * regardless of what the UI does — the gate lives in `ManageMemberBiometric`,
 * not the route — but a UI that lets staff press the button and then shows
 * them an error has already asked the member to put their finger on a sensor.
 *
 * ## What this deliberately does not assert
 *
 * The "Fingerprint registered" state is unreachable from E2E. The provider
 * factory returns a fresh `MockAccessControlProvider` per request, so
 * `listSubjects` always answers empty and enrolment detection can never flip
 * the flag. That leg stays covered by `useEnrolmentPoll.test.tsx` and the
 * `DetectBiometricEnrolment` unit tests. Forcing it here would need global
 * mock state — shared across the whole unit suite — or a test backdoor in the
 * app, and both cost more than the coverage is worth.
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  E2E_ACCESS_CONTROL_ENABLED,
  E2E_LITE_GYM_CONFIGURED,
  connectReader,
  ensureVendorAccount,
  forgetReader,
  loginAsEnterpriseGym,
  loginAsLiteGym,
  uniqueSerial,
} from './helpers/access-control'

test.skip(
  !E2E_ACCESS_CONTROL_ENABLED,
  'requires E2E_ACCESS_CONTROL=1 + a seeded Enterprise gym'
)

test.describe.configure({ mode: 'serial' })

const READER = { serial: uniqueSerial('MEMB'), name: 'Member Spec Reader' }

/**
 * Wait for the access section inside an open member modal.
 *
 * `MemberAccessPanel` is a `dynamic()` import, so the modal is visible well
 * before its Door Access section exists. Every branch below reads `count()`,
 * which does **not** auto-wait — so a panel that has not rendered yet is
 * indistinguishable from "no consent gate offered" or "no fingerprint on
 * file", and the spec quietly takes the wrong branch against a page that is
 * about to show the opposite. In the withdrawal test that wrong branch is a
 * `test.skip`, and a skip reports green (trap 17): the assertion never runs
 * and the run still looks clean.
 */
async function waitForAccessPanel(page: Page): Promise<void> {
  // Longer than the default: this is the first render of a `dynamic()` chunk
  // against a `next dev` server that compiles it on demand.
  await expect(page.getByRole('dialog').getByText('Door Access')).toBeVisible({
    timeout: 30_000,
  })
}

/** Open the first member in the list and wait for the modal. */
async function openFirstMember(page: Page): Promise<void> {
  await page.goto('/members')

  // Rows are clickable; the first data row is enough — these assertions are
  // about the panel, not about which member is in it.
  // Re-click until the panel opens, rather than click once and wait longer.
  // Two dev-only effects stack here: the row's handler is not attached until
  // React hydrates, so an early click is swallowed silently and no amount of
  // waiting afterwards recovers it; and the modal is a `dynamic()` import, so
  // the click that does land still pays for compiling that chunk. Waiting
  // alone only fixes the second. Same treatment as the login form in
  // `helpers/billing.ts`, for the same reason.
  await expect(async () => {
    await page.getByRole('row').nth(1).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 60_000 })
}

/**
 * Open the first member in the list who may currently enter.
 *
 * Since 2026-09-23 the enrolment path resolves the access decision first and
 * refuses a member who cannot get in (F27/Y2) — the panel says "This
 * membership is not active…". "The first row" stopped being a usable fixture
 * the day the seeded gym's newest member (Stress Member 264, due 2026-10-02)
 * expired: the spec went red for a refusal the product is right to make. The
 * list order is stable, so this finds the same member on every call.
 */
async function openEnrollableMember(page: Page): Promise<void> {
  await page.goto('/members')

  for (let row = 1; row <= 15; row += 1) {
    await expect(async () => {
      await page.getByRole('row').nth(row).click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 60_000 })

    await waitForAccessPanel(page)
    const panel = page.getByRole('dialog')
    await expect(panel.getByText(/Can get in|Cannot get in/)).toBeVisible()

    if (await panel.getByText('Can get in').isVisible()) return

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  }

  throw new Error(
    'openEnrollableMember: none of the first 15 members can currently get in — the seeded gym needs an active, paid-up member'
  )
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await loginAsEnterpriseGym(page)
  await ensureVendorAccount(page)
  // Enrolment needs somewhere to enrol: with no active reader the panel says
  // so instead of offering the button.
  await connectReader(page, READER)
  await page.close()
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await loginAsEnterpriseGym(page)
  await forgetReader(page, READER.name)
  await page.close()
})

test('shows a verdict in plain language, never a vendor string', async ({
  page,
}) => {
  await loginAsEnterpriseGym(page)
  await openFirstMember(page)

  await waitForAccessPanel(page)

  const panel = page.getByRole('dialog')
  await expect(panel.getByText('Door Access')).toBeVisible()
  await expect(panel.getByText(/Can get in|Cannot get in/)).toBeVisible()

  // The explanation is derived from our own decision — "Membership payment is
  // overdue" — not from anything the terminal said. It has no opinion about
  // why it refused someone and never tells us.
  const text = await panel.innerText()
  expect(text).not.toMatch(/\breturn code\b/i)
  expect(text).not.toMatch(/(^|\s)-\d{1,4}(\s|$)/)
})

test('will not enrol a fingerprint until consent is given', async ({
  page,
}) => {
  await loginAsEnterpriseGym(page)
  await openFirstMember(page)

  await waitForAccessPanel(page)

  const panel = page.getByRole('dialog')
  const enrol = panel.getByRole('button', { name: /register fingerprint/i })

  // A member with no consent on file: the tick is offered and the button that
  // would take a fingerprint is inert until it is answered.
  const consent = panel.getByRole('checkbox')

  if ((await consent.count()) === 0) {
    // Consent is already recorded for this member from an earlier run. The
    // gate is then correctly absent — assert that instead of failing, since
    // re-consenting is not something the design asks for.
    await expect(
      panel.getByText(/Consent to record a fingerprint given on/)
    ).toBeVisible()
    return
  }

  await expect(enrol).toBeDisabled()

  await consent.check()
  await expect(enrol).toBeEnabled()
})

test('records the consent and starts waiting for a finger', async ({
  page,
}) => {
  await loginAsEnterpriseGym(page)
  await openEnrollableMember(page)

  const panel = page.getByRole('dialog')
  const consent = panel.getByRole('checkbox')

  // Only the tick is conditional. Consent may already be on file — from the
  // test above, or from an earlier run — and in that state the checkbox is
  // correctly gone, but the enrolment still has to be dispatched to reach the
  // waiting state this test is about. Clicking inside the branch conflated
  // "needs consent" with "needs enrolling", so a member who had already
  // consented never got as far as the assertion.
  if ((await consent.count()) > 0) {
    await consent.check()
  }

  await panel.getByRole('button', { name: /register fingerprint/i }).click()

  // "Awaiting" is an instruction, not a progress bar: the thing being waited
  // on is a person walking to a terminal. It also names the scan, because that
  // is the only confirmation this vendor offers — VFT, 2026-09-23: the finger
  // count arrives in a future update, and today a fingerprint "is considered
  // with the attendance record".
  await expect(
    panel.getByText(/place their finger on the reader/i)
  ).toBeVisible()

  // Reopening shows the consent as a dated record, which is the point of
  // keeping it rather than a bare boolean.
  await page.reload()
  await openEnrollableMember(page)
  await expect(
    page
      .getByRole('dialog')
      .getByText(/Consent to record a fingerprint given on/)
  ).toBeVisible()
})

test('says removing a fingerprint also withdraws the consent', async ({
  page,
}) => {
  await loginAsEnterpriseGym(page)
  await openFirstMember(page)

  await waitForAccessPanel(page)

  const panel = page.getByRole('dialog')
  const remove = panel.getByRole('button', { name: /remove fingerprint/i })

  test.skip(
    (await remove.count()) === 0,
    'no fingerprint on file for this member — nothing to withdraw'
  )

  await remove.click()

  // Removing the fingerprint IS the withdrawal, and the dialog has to say so:
  // the member is agreeing to lose a record, not just a convenience, and will
  // be asked again before any new fingerprint is taken.
  await expect(page.getByText(/withdraws their consent/i)).toBeVisible()
  await expect(
    page.getByText(/membership and payments are not affected/i)
  ).toBeVisible()
})

test('is absent entirely for a gym without the capability', async ({
  page,
}) => {
  test.skip(
    !E2E_LITE_GYM_CONFIGURED,
    'requires E2E_LITE_GYM_EMAIL / E2E_LITE_GYM_PASSWORD'
  )

  await loginAsLiteGym(page)
  await openFirstMember(page)

  // Gated on the server-computed capability, not on a failed request. A Lite
  // gym opening a member must not fire a 403 for every modal — the panel
  // simply is not there.
  await expect(page.getByRole('dialog').getByText('Door Access')).toHaveCount(0)
})
