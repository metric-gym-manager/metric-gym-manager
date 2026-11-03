/**
 * @jest-environment node
 */

/**
 * Every request that changes an account setting refuses to be sent by another
 * website (`rejectCrossSiteRequest`, `lib/middleware/sameOrigin.ts`).
 *
 * The routes are found by reading this folder, not listed by hand, so a route
 * added here later is held to the same rule without anyone remembering to add
 * it. Each mutating handler is called as another site's form would call it:
 * `Sec-Fetch-Site: cross-site`, a `text/plain` JSON body. It must answer 403
 * before it does anything — the session lookup and the database client throw if
 * they are reached. A same-origin call must get past the guard (to validation
 * or the missing session), so the test cannot pass by refusing everything.
 */

import { readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { NextRequest } from 'next/server'

const reached = jest.fn()

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: async () => {
    reached('getCurrentGymProfile')
    throw new Error('Unauthorized')
  },
  requireAuth: async () => {
    reached('requireAuth')
    throw new Error('Unauthorized')
  },
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    reached('createClient')
    throw new Error('Unauthorized')
  },
  createAdminClient: () => {
    reached('createAdminClient')
    throw new Error('Unauthorized')
  },
}))

const ROOT = join(__dirname, '..')
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

const handlers: [string, string, Handler][] = routeFiles(ROOT).flatMap(
  (file) => {
    const mod = require(file) as Record<string, Handler | undefined>
    const at = relative(ROOT, file).replace(/\/route\.ts$/, '')
    return MUTATING.filter((m) => typeof mod[m] === 'function').map(
      (m) => [at, m, mod[m] as Handler] as [string, string, Handler]
    )
  }
)

const request = (method: string, site: string) =>
  new NextRequest('http://localhost/api/settings/security/x', {
    method,
    headers: { 'content-type': 'text/plain', 'sec-fetch-site': site },
    body: JSON.stringify({ phone_number: '0771234567', username: 'attacker' }),
  })

beforeEach(() => {
  reached.mockClear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it('finds the account-setting routes it is meant to hold', () => {
  const found = handlers.map(([at, m]) => `${m} ${at}`)
  // The four that exist today; a new one only adds to this list.
  expect(found).toEqual(
    expect.arrayContaining([
      'POST email',
      'POST password',
      'POST phone',
      'POST username',
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
