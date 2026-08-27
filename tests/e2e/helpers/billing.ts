/**
 * E2E helpers for the billing flows (plan §6.3).
 *
 * Requirements (all specs skip without them):
 *   E2E_BILLING=1
 *   E2E_GYM_EMAIL / E2E_GYM_PASSWORD  — seeded gym-manager login
 *   PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET — must match the dev
 *   server's env so simulated webhooks verify.
 *
 * PayHere itself is never driven: the webhook is simulated by POSTing a
 * correctly-signed form body to /api/webhooks/payhere.
 */

import { createHash } from 'crypto'
import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * A note on sign-in volume, before someone optimises it again.
 *
 * Every spec logs in from `beforeEach`, which is roughly twenty sign-ins per
 * run against Supabase's per-IP limit on the token endpoint. Past that limit
 * it answers 429, `auth.service.ts` flattens any auth error to one string, and
 * the run claims "Invalid username or password" for a credential that is
 * perfectly valid — drifting between tests as the quota is reached at
 * different points. If that reappears, space the runs out.
 *
 * **Two fixes have been tried and both made it worse. Measure before a third.**
 *
 * 1. *Caching the session cookies and replaying them.* Supabase rotates
 *    refresh tokens, so a replayed pair retires the one the next test needs,
 *    reuse detection revokes the session family, and the page still renders
 *    from a cookie middleware accepts while every API call beneath it answers
 *    Unauthorized. 14 passing → 6; Unauthorized 2 → 12. Re-capturing the
 *    cookies after each replay did not help.
 *
 * 2. *`storageState` seeded by a setup project.* Closer — one sign-in for the
 *    whole run — but it only reaches pages the fixture creates. These specs
 *    build their own contexts with `browser.newPage()` in `beforeAll` and
 *    `afterAll`, and those do **not** inherit a project's `storageState`, so
 *    the run ends up half seeded and half anonymous. The cleanup helpers are
 *    the ones on the anonymous side, which is why readers stopped being
 *    forgotten and the next run inherited them. 14 passing → 11.
 *
 * A third attempt has to start by giving those `browser.newPage()` call sites
 * the same session — or by removing them — not by choosing a different place
 * to keep the tokens. A gym per worker solves the shared-state problem too and
 * is the more valuable change.
 */

export const E2E_BILLING_ENABLED = process.env.E2E_BILLING === '1'

const md5Upper = (s: string): string =>
  createHash('md5').update(s, 'utf8').digest('hex').toUpperCase()

/**
 * Log in as a seeded gym manager.
 *
 * @param page - Playwright page.
 * @param credentials - Which gym to log in as. Defaults to the billing seed
 *   (`E2E_GYM_EMAIL` / `E2E_GYM_PASSWORD`); the access-control specs pass an
 *   Enterprise gym instead. Parameterised rather than copied so the hydration
 *   workaround below lives in exactly one place.
 */
export async function loginAsGym(
  page: Page,
  credentials: { email?: string; password?: string } = {}
): Promise<void> {
  const email = credentials.email ?? process.env.E2E_GYM_EMAIL ?? ''
  const password = credentials.password ?? process.env.E2E_GYM_PASSWORD ?? ''

  if (!email || !password) {
    throw new Error(
      'loginAsGym: no credentials. Set E2E_GYM_EMAIL / E2E_GYM_PASSWORD, or pass them in.'
    )
  }

  await page.goto('/login')

  // Exact, not /email/i. The page also carries a resend-verification input
  // whose aria-label contains "Email"; it is hidden until a verification error
  // shows it, at which point a loose match resolves to two elements and every
  // retry below dies on strict mode instead of logging in.
  const emailField = page.getByLabel('Email', { exact: true })
  const passwordField = page.getByLabel('Password', { exact: true })

  // Prove the form is there before entering the retry loop. Without this a
  // missing or renamed field is reported as a 30-second timeout blaming
  // `toPass`, with no clue which locator failed; this fails in seconds with
  // Playwright's page snapshot attached.
  await expect(
    emailField,
    `login form never appeared at ${page.url()} — is the dev server serving /login?`
  ).toBeVisible({ timeout: 15_000 })

  // Dev-mode hydration can lag behind first paint: values filled into the
  // uncontrolled DOM are wiped when React hydrates the controlled inputs and
  // clicks are swallowed. Re-fill and re-click until the request fires.
  let status = 0
  let body = ''

  await expect(async () => {
    // An earlier attempt may have succeeded after its response window closed,
    // in which case the app has already navigated and there is no form left to
    // fill. That is a login, not a failure — without this check every
    // remaining retry re-fills fields that no longer exist and the test dies
    // on its own timeout with the helper still insisting it never logged in.
    if (!(await emailField.count())) {
      status = 200
      return
    }

    await emailField.fill(email)
    await passwordField.fill(password)
    // Long enough to cover a cold `next dev` compiling the auth route on first
    // touch. At 3s a perfectly good request was abandoned mid-flight and
    // retried, which is how a working login presented as one that never
    // answered. Retrying still recovers a click swallowed by hydration — the
    // case this loop exists for — because that produces no response at all.
    const loginResponse = page.waitForResponse('**/api/auth/login', {
      timeout: 20_000,
    })
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).click()
    const response = await loginResponse
    status = response.status()
    body = await response.text().catch(() => '')
  }).toPass({ timeout: 60_000 })

  // Say what actually happened. Retrying a rejected credential cannot help, so
  // without this a wrong password, an unconfirmed email or a gym pointed at the
  // wrong Supabase project all present identically: a 30-second timeout inside
  // `toPass` whose stack blames the retry wrapper rather than the cause.
  if (status !== 200) {
    throw new Error(
      `loginAsGym: /api/auth/login answered ${status} for ${email}. ${body.slice(0, 200)}`
    )
  }

  // The redirect is a full-document navigation (rule 2.15), so this waits on a
  // real page load rather than a client-side route change.
  await page.waitForURL('**/dashboard**')
}

export interface SimulatedWebhook {
  order_id: string
  payment_id: string
  payhere_amount: string
  status_code: string
  subscription_id?: string
  custom_1?: string
  message_type?: string
  item_rec_status?: string
}

/** POST a correctly-signed notification to the running dev server. */
export async function simulateWebhook(
  request: APIRequestContext,
  fields: SimulatedWebhook
): Promise<void> {
  const merchantId = process.env.PAYHERE_MERCHANT_ID ?? ''
  const secret = process.env.PAYHERE_MERCHANT_SECRET ?? ''
  const form: Record<string, string> = {
    merchant_id: merchantId,
    payhere_currency: 'LKR',
    ...(Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    ) as Record<string, string>),
  }
  form.md5sig = md5Upper(
    merchantId +
      form.order_id +
      form.payhere_amount +
      form.payhere_currency +
      form.status_code +
      md5Upper(secret)
  )

  const response = await request.post('/api/webhooks/payhere', { form })
  if (response.status() !== 200) {
    throw new Error(`Simulated webhook returned ${response.status()}`)
  }
}
