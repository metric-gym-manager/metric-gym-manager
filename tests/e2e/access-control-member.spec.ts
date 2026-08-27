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

/** Open the first member in the list and wait for the modal. */
async function openFirstMember(page: Page): Promise<void> {
  await page.goto('/members')

  // Rows are clickable; the first data row is enough — these assertions are
  // about the panel, not about which member is in it.
  await page.getByRole('row').nth(1).click()
  await expect(page.getByRole('dialog')).toBeVisible()
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
  await openFirstMember(page)

  const panel = page.getByRole('dialog')
  const consent = panel.getByRole('checkbox')

  if ((await consent.count()) > 0) {
    await consent.check()
    await panel.getByRole('button', { name: /register fingerprint/i }).click()
  }

  // "Awaiting" is an instruction, not a progress bar: the thing being waited
  // on is a person walking to a terminal. It is also the only honest answer
  // the vendor can give — the template exists once a finger is presented, and
  // nothing reports that back.
  await expect(
    panel.getByText(/place their finger on the reader/i)
  ).toBeVisible()

  // Reopening shows the consent as a dated record, which is the point of
  // keeping it rather than a bare boolean.
  await page.reload()
  await openFirstMember(page)
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
