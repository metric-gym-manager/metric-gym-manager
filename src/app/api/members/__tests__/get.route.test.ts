/**
 * @jest-environment node
 */

/**
 * GET /api/members/[id] — the not-found reply.
 *
 * It used to read "Member not found not found": the route passed a finished
 * sentence to `ResponseBuilder.notFound`, which appends its own suffix.
 */

import { NextRequest } from 'next/server'

const mockFindById = jest.fn()

jest.mock('@/lib/middleware/api-auth', () => ({
  getApiGymProfile: jest.fn(async () => ({
    gymProfile: { id: 'gym-1' },
    error: null,
  })),
}))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({})),
}))
jest.mock('@/features/members', () => ({
  createMemberRepository: jest.fn(() => ({ findById: mockFindById })),
  createUpdateMemberProfile: jest.fn(),
}))
jest.mock('@/features/access-control', () => ({
  createPushRename: jest.fn(),
}))

import { GET } from '../[id]/route'

const call = () =>
  GET(new NextRequest('http://localhost/api/members/m-1'), {
    params: Promise.resolve({ id: 'm-1' }),
  })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('GET /api/members/[id]', () => {
  it('answers a missing member with 404 and a readable message', async () => {
    mockFindById.mockResolvedValue(null)

    const res = await call()
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Member not found')
  })
})
