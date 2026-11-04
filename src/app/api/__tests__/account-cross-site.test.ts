/**
 * @jest-environment node
 */

/**
 * Every request that signs a browser in or out, or changes an account's
 * credentials, refuses to be sent by another website
 * (`rejectCrossSiteRequest`, `lib/middleware/sameOrigin.ts`).
 *
 * The class is `api/auth` and `api/settings/security` together. This test once
 * read the second folder alone, and that is how the sign-in route stayed open
 * to login CSRF in production while the test stayed green
 * (release-1.6.2-inverted-check.md R1): login needs no session, so
 * `SameSite=Lax` cookies do not protect it, and it lived in the folder nobody
 * read.
 *
 * The routes are found by reading both folders, not listed by hand, so a route
 * added there later is held to the same rule without anyone remembering to add
 * it. Each mutating handler is called as another site's form would call it:
 * `Sec-Fetch-Site: cross-site`, a `text/plain` JSON body. It must answer 403
 * before it does anything — the session lookup, the auth services, the rate
 * limiter and the database client throw if they are reached. A same-origin
 * call must get past the guard (to validation or the missing session), so the
 * test cannot pass by refusing everything.
 */

import { readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { NextRequest } from 'next/server'

const reached = jest.fn()

/** A module whose every export records the call and throws. */
function unreachable(name: string) {
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === '__esModule') return true
        return async () => {
          reached(`${name}.${String(key)}`)
          throw new Error('Unauthorized')
        }
      },
    }
  )
}

jest.mock('@/lib/middleware/auth', () => unreachable('middleware/auth'))
jest.mock('@/lib/supabase/server', () => unreachable('supabase/server'))
jest.mock('@/features/auth/services/auth.service', () =>
  unreachable('auth.service')
)
jest.mock('@/features/auth/services/email-confirmation.service', () =>
  unreachable('email-confirmation.service')
)
jest.mock('next/headers', () => unreachable('next/headers'))
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => {
    reached('rate-limit')
    throw new Error('Unauthorized')
  },
}))

const API = join(__dirname, '..')
const ACCOUNT_ROOTS = ['auth', 'settings/security']
const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'] as const

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      return name === '__tests__' ? [] : routeFiles(full)
    }
    return name === 'route.ts' ? [full] : []
  })
}

type Handler = (request: NextRequest) => Promise<Response>

const handlers: [string, string, Handler][] = ACCOUNT_ROOTS.flatMap((root) =>
  routeFiles(join(API, root))
).flatMap((file) => {
  const mod = require(file) as Record<string, Handler | undefined>
  const at = relative(API, file).replace(/\/route\.ts$/, '')
  return MUTATING.filter((m) => typeof mod[m] === 'function').map(
    (m) => [at, m, mod[m] as Handler] as [string, string, Handler]
  )
})

const request = (method: string, site: string) =>
  new NextRequest('http://localhost/api/auth/x', {
    method,
    headers: { 'content-type': 'text/plain', 'sec-fetch-site': site },
    body: JSON.stringify({
      email: 'attacker@example.invalid',
      password: 'attacker-password',
      phone_number: '0771234567',
      username: 'attacker',
    }),
  })

beforeEach(() => {
  reached.mockClear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it('finds the account routes it is meant to hold', () => {
  const found = handlers.map(([at, m]) => `${m} ${at}`)
  // The ones that exist today; a new one only adds to this list.
  expect(found).toEqual(
    expect.arrayContaining([
      'POST auth/forgot-password',
      'POST auth/login',
      'POST auth/logout',
      'POST auth/register',
      'POST auth/resend-confirmation',
      'POST auth/reset-password',
      'POST auth/verify-email',
      'POST settings/security/email',
      'POST settings/security/password',
      'POST settings/security/phone',
      'POST settings/security/username',
    ])
  )
})

describe.each(handlers)('%s (%s)', (_at, method, handler) => {
  it('refuses a request another website sent, before doing anything', async () => {
    const res = await handler(request(method, 'cross-site'))

    expect(res.status).toBe(403)
    expect(reached).not.toHaveBeenCalled()
  })

  it('lets a request from our own pages past the guard', async () => {
    const res = await handler(request(method, 'same-origin'))

    expect(res.status).not.toBe(403)
  })
})
