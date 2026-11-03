/**
 * @jest-environment node
 */

/**
 * POST /api/members/[id]/suspend | cancel | activate — the refusals each route
 * maps. A manual transition is computed from the status the request read; when
 * another request changed it first the use case throws ConflictError, which
 * must reach the screen as 409 with its message (not a 500 "Failed to …").
 */

import { NextRequest } from 'next/server'
import {
  ConflictError,
  InvalidStatusTransitionError,
  NotFoundError,
} from '@/utils/errors'
import { MEMBER_CHANGED_MESSAGE } from '@/features/members/services/IMemberRepository'

const execute = jest.fn()

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: async () => ({
    id: 'gym-1',
    gym_name: 'Titan Fitness',
  }),
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/features/members', () => ({
  createSuspendMember: () => ({ execute }),
  createCancelMember: () => ({ execute }),
  createReactivateMember: () => ({ execute }),
}))

import { POST as suspend } from '../suspend/route'
import { POST as cancel } from '../cancel/route'
import { POST as activate } from '../activate/route'

const MEMBER_ID = '11111111-1111-4111-8111-111111111111'
const CONFLICT = MEMBER_CHANGED_MESSAGE

type Handler = typeof suspend

const call = (handler: Handler, body?: unknown) =>
  handler(
    new NextRequest(`http://localhost/api/members/${MEMBER_ID}/action`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: MEMBER_ID }) }
  )

beforeEach(() => {
  execute.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe.each<[string, Handler, unknown]>([
  ['suspend', suspend, undefined],
  ['cancel', cancel, undefined],
  ['activate', activate, { newDueDate: '2026-12-01' }],
])('POST /api/members/[id]/%s', (_name, handler, body) => {
  it('answers 409 with the message when the member changed since it was read', async () => {
    execute.mockRejectedValue(new ConflictError(CONFLICT))

    const res = await call(handler, body)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error.code).toBe('CONFLICT')
    expect(json.error.message).toBe(CONFLICT)
  })

  it('still answers 404 for a member that is not in this gym', async () => {
    execute.mockRejectedValue(new NotFoundError('Member'))

    expect((await call(handler, body)).status).toBe(404)
  })

  it('still answers 400 for a transition the state machine forbids', async () => {
    execute.mockRejectedValue(
      new InvalidStatusTransitionError('active', 'active')
    )

    expect((await call(handler, body)).status).toBe(400)
  })
})
