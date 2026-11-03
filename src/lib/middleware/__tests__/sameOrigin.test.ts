/**
 * @jest-environment node
 */

/**
 * `rejectCrossSiteRequest` — the guard on the sign-in and account endpoints.
 *
 * A browser lets any website POST a `text/plain` form to any other origin
 * without a CORS preflight, and `request.json()` parses such a body happily.
 * Measured 2026-10-28: a `text/plain` POST carrying `Origin: https://evil.example`
 * reached `signInWithIdToken` on /api/auth/google. With an attacker's own valid
 * token and nonce, that signs the visitor's browser into the attacker's account
 * (login CSRF). Browsers label every request with `Sec-Fetch-Site`, and send
 * `Origin` on every cross-origin POST, so a site can tell its own pages apart.
 */
import { rejectCrossSiteRequest } from '../sameOrigin'

const req = (headers: Record<string, string>) =>
  new Request('https://www.metricgymos.com/api/auth/google', {
    method: 'POST',
    headers,
  })

describe('rejectCrossSiteRequest', () => {
  it('lets a request from our own pages through', () => {
    expect(
      rejectCrossSiteRequest(req({ 'sec-fetch-site': 'same-origin' }))
    ).toBeNull()
  })

  it('lets a user-initiated request (typed URL, bookmark) through', () => {
    expect(rejectCrossSiteRequest(req({ 'sec-fetch-site': 'none' }))).toBeNull()
  })

  it.each(['cross-site', 'same-site'])(
    'refuses a %s request with 403',
    (site) => {
      const response = rejectCrossSiteRequest(req({ 'sec-fetch-site': site }))
      expect(response?.status).toBe(403)
    }
  )

  it('falls back to Origin when the browser sends no Sec-Fetch-Site', () => {
    expect(
      rejectCrossSiteRequest(req({ origin: 'https://www.metricgymos.com' }))
    ).toBeNull()
    expect(
      rejectCrossSiteRequest(req({ origin: 'https://evil.example' }))?.status
    ).toBe(403)
  })

  it('refuses an Origin that cannot be parsed', () => {
    expect(rejectCrossSiteRequest(req({ origin: 'null' }))?.status).toBe(403)
  })

  it('lets a non-browser client with neither header through', () => {
    // Server-to-server callers and tests send neither; CSRF needs a browser.
    expect(rejectCrossSiteRequest(req({}))).toBeNull()
  })

  it('trusts Sec-Fetch-Site over a matching Origin', () => {
    expect(
      rejectCrossSiteRequest(
        req({
          'sec-fetch-site': 'cross-site',
          origin: 'https://www.metricgymos.com',
        })
      )?.status
    ).toBe(403)
  })
})
