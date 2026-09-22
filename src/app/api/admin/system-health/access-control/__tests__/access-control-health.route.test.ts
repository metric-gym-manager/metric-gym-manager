/**
 * @jest-environment node
 */

/**
 * GET /api/admin/system-health/access-control.
 *
 * The screen an operator watches during a hardware session, and the only place
 * a dead sync job is visible at all. Two things it must get right: the gate
 * (raw vendor errors, SaaS admins only) and the **magnitude** — a count taken
 * from the returned page rather than the table stops moving at the page size,
 * so a problem that is growing looks like a problem that is stable. This
 * deployment had 660 dead jobs while the page held 50.
 */

const mockGetSaasAdmin = jest.fn()

jest.mock('@/lib/auth/requireSaasAdmin', () => ({
  getSaasAdmin: (...args: unknown[]) => mockGetSaasAdmin(...args),
}))

const mockFrom = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

import { GET } from '../route'

/** One dead job row, repeated to fill a page. */
const deadJob = (i: number) => ({
  id: `job-${i}`,
  gym_id: 'gym-1',
  member_id: 'member-1',
  intent: 'reconcile_member',
  status: 'dead',
  attempts: 6,
  last_error: 'Stored vendor credentials cannot be decrypted',
  updated_at: '2026-09-22T00:30:49Z',
})

/**
 * Minimal Supabase query-builder double.
 *
 * Returns itself for every chained filter and resolves when awaited, so the
 * route's own chain shape is what is exercised. `resolve` is given the filters
 * that were applied — a count query is only meaningful in terms of what it
 * filtered on, and a double that ignores that would answer the same number to
 * every question, which is how a double hides the bug you are hunting.
 */
function builder(resolve: (filters: Record<string, unknown>) => unknown) {
  const filters: Record<string, unknown> = {}
  const chain: Record<string, unknown> = {}

  for (const method of ['select', 'in', 'order', 'limit']) {
    chain[method] = jest.fn(() => chain)
  }

  chain.eq = jest.fn((column: string, value: unknown) => {
    filters[column] = value
    return chain
  })

  chain.then = (onFulfilled: (value: unknown) => unknown) =>
    onFulfilled(resolve(filters))

  return chain
}

describe('GET /api/admin/system-health/access-control', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSaasAdmin.mockResolvedValue({ id: 'admin-1', email: 'ops@x.com' })
  })

  const request = () =>
    ({
      url: 'https://app.example.com/api/admin/system-health/access-control',
    }) as unknown as Parameters<typeof GET>[0]

  it('refuses a non-admin before querying anything', async () => {
    mockGetSaasAdmin.mockResolvedValue(null)

    const res = await GET(request())

    expect(res.status).toBe(403)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  /**
   * Inverted (2026-09-23): counting against the table fixed the magnitude, but
   * a count is only true of the thing it filtered. If the exact-count queries
   * dropped the `gymId` scope that the page query keeps, a single gym's view
   * would report the whole platform's dead jobs — a worse lie than the
   * page-sized one it replaced, because it looks authoritative.
   */
  it('scopes the counts to the gym when one is asked for', async () => {
    const seen: Record<string, unknown>[] = []

    mockFrom.mockImplementation((table: string) => {
      if (table === 'access_devices') {
        return builder(() => ({ data: [], error: null }))
      }
      return builder((filters) => {
        seen.push(filters)
        return typeof filters.status === 'string'
          ? { data: null, error: null, count: 3 }
          : { data: [], error: null }
      })
    })

    const res = await GET({
      url: 'https://app.example.com/api/admin/system-health/access-control?gymId=gym-1',
    } as unknown as Parameters<typeof GET>[0])

    expect(res.status).toBe(200)

    const counts = seen.filter((f) => typeof f.status === 'string')
    expect(counts).toHaveLength(2)
    counts.forEach((f) => expect(f.gym_id).toBe('gym-1'))
  })

  it('reports the true number of dead jobs, not the size of the page', async () => {
    const page = Array.from({ length: 50 }, (_, i) => deadJob(i))

    // The page is capped at 50; the table holds 660 dead and 9 retrying.
    const totals: Record<string, number> = { dead: 660, failed: 9 }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'access_devices') {
        return builder(() => ({ data: [], error: null }))
      }

      return builder((filters) =>
        typeof filters.status === 'string'
          ? { data: null, error: null, count: totals[filters.status] }
          : { data: page, error: null }
      )
    })

    const res = await GET(request())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.summary.deadJobs).toBe(660)
    expect(json.data.summary.retryingJobs).toBe(9)
    // The detail list stays a page — it is read by a human, not summed.
    expect(json.data.jobs).toHaveLength(50)
  })
})
