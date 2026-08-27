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

  // Dev-mode hydration can lag behind first paint: values filled into the
  // uncontrolled DOM are wiped when React hydrates the controlled inputs and
  // clicks are swallowed. Re-fill and re-click until the request fires.
  let status = 0
  let body = ''

  await expect(async () => {
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    const loginResponse = page.waitForResponse('**/api/auth/login', {
      timeout: 3000,
    })
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).click()
    const response = await loginResponse
    status = response.status()
    body = await response.text().catch(() => '')
  }).toPass({ timeout: 30_000 })

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
