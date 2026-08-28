/**
 * The webhook path token guard.
 *
 * VFT's push protocol defines no signature scheme, so the token in the URL
 * path is the *entire* credential on `/api/webhooks/access-control/[token]`.
 * That makes one specific misconfiguration invisible: `.env.example` documents
 * the variable as `ACCESS_CONTROL_WEBHOOK_TOKEN=your-hex-64-webhook-token`, and
 * a `.env.local` copied from it authenticates successfully against a value
 * committed to the repository. Every probe returns the same `200` a correct
 * deployment returns. There is no symptom to notice.
 *
 * These tests exist because that happened — a stale `.env.local` held the
 * placeholder for long enough to produce a false conclusion about what
 * production was serving.
 */

import {
  describeWebhookTokenProblem,
  getWebhookPathToken,
  MIN_WEBHOOK_TOKEN_LENGTH,
} from '../config'

/** A realistic `openssl rand -hex 32` value. */
const REAL_TOKEN =
  'a3f9c1e07b25d8460f1a9c3e5b7d2048e6c4a1b93f0d7e28c5a6b4d1f8e0392c'

describe('describeWebhookTokenProblem', () => {
  it('accepts a generated token', () => {
    expect(describeWebhookTokenProblem(REAL_TOKEN)).toBeNull()
  })

  it('refuses the exact placeholder that ships in .env.example', () => {
    const problem = describeWebhookTokenProblem('your-hex-64-webhook-token')

    expect(problem).toMatch(/placeholder/i)
    // The message has to carry the fix, because whoever reads this log line is
    // looking at a webhook that returns 401 for reasons they cannot see.
    expect(problem).toMatch(/openssl rand -hex 32/)
  })

  it('refuses the other ways a placeholder is written', () => {
    for (const value of [
      'your_webhook_token_goes_here_1234567890',
      'CHANGEME-CHANGEME-CHANGEME-CHANGEME',
      'change-me-before-deploying-this-app-ok',
      'replace-with-a-real-secret-value-here',
      'placeholder-placeholder-placeholder-x',
      'example-token-value-for-documentation',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'TODO-generate-a-proper-secret-for-this',
    ]) {
      expect(describeWebhookTokenProblem(value)).toMatch(/placeholder/i)
    }
  })

  it('says "placeholder" rather than "too short" when it is both', () => {
    // The placeholder is 25 characters, so both rules fire. The one naming the
    // actual mistake is the useful one.
    const problem = describeWebhookTokenProblem('your-hex-64-webhook-token')

    expect(problem).toMatch(/placeholder/i)
    expect(problem).not.toMatch(/characters; at least/)
  })

  it('distinguishes unset from set-but-empty', () => {
    expect(describeWebhookTokenProblem(undefined)).toMatch(/is not set/)
    expect(describeWebhookTokenProblem('   ')).toMatch(/set but empty/)
  })

  it('refuses a value too short to be the only credential on the endpoint', () => {
    const short = 'a'.repeat(MIN_WEBHOOK_TOKEN_LENGTH - 1)

    expect(describeWebhookTokenProblem(short)).toMatch(/characters; at least/)
    expect(
      describeWebhookTokenProblem('b'.repeat(MIN_WEBHOOK_TOKEN_LENGTH))
    ).toBeNull()
  })

  it('never rejects a hex token, whatever the markers say', () => {
    // Every placeholder marker needs a letter beyond `f`, so no hex string can
    // contain one. This is what makes substring matching safe.
    for (let i = 0; i < 200; i++) {
      const hex = Array.from({ length: 64 }, () =>
        '0123456789abcdef'.charAt(Math.floor(Math.random() * 16))
      ).join('')

      expect(describeWebhookTokenProblem(hex)).toBeNull()
    }
  })
})

describe('getWebhookPathToken', () => {
  const original = process.env.ACCESS_CONTROL_WEBHOOK_TOKEN

  afterEach(() => {
    if (original === undefined) delete process.env.ACCESS_CONTROL_WEBHOOK_TOKEN
    else process.env.ACCESS_CONTROL_WEBHOOK_TOKEN = original
  })

  it('returns a generated token', () => {
    process.env.ACCESS_CONTROL_WEBHOOK_TOKEN = REAL_TOKEN

    expect(getWebhookPathToken()).toBe(REAL_TOKEN)
  })

  it('fails closed on the placeholder, exactly as if it were unset', () => {
    process.env.ACCESS_CONTROL_WEBHOOK_TOKEN = 'your-hex-64-webhook-token'

    // The route treats null as "refuse everything". A placeholder must land in
    // the same branch — accepting it would authenticate the whole internet.
    expect(getWebhookPathToken()).toBeNull()
  })

  it('trims surrounding whitespace', () => {
    // A token pasted into a hosting dashboard with a trailing newline would
    // otherwise mismatch on every request, giving the same silent 401 as a
    // wrong value.
    process.env.ACCESS_CONTROL_WEBHOOK_TOKEN = `  ${REAL_TOKEN}\n`

    expect(getWebhookPathToken()).toBe(REAL_TOKEN)
  })

  it('returns null when unset', () => {
    delete process.env.ACCESS_CONTROL_WEBHOOK_TOKEN

    expect(getWebhookPathToken()).toBeNull()
  })
})
