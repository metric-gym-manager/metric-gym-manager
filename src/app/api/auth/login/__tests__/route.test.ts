/**
 * @jest-environment node
 */

/**
 * POST /api/auth/login — sign-in is rate limited (remote day, F-09).
 *
 * The endpoint answered an unbounded number of password guesses. Two in-memory
 * limits now sit in front of the password check: 10 attempts per IP and 5 per
 * email, per 15 minutes, answering 429. They are per serverless instance (the
 * limiter says so) — a dampener on guessing, not a global guarantee.
 *
 * The real limiter is used here, reset between tests, so the counting itself is
 * what is under test; only the auth service and the cookie store are mocked.
 */

import { NextRequest } from 'next/server'
import { resetRateLimits } from '@/lib/rate-limit'

const loginWithPassword = jest.fn()

jest.mock('@/features/auth/services/auth.service', () => ({
  loginWithPassword: (...args: unknown[]) => loginWithPassword(...args),
}))
jest.mock('next/headers', () => ({
  cookies: async () => ({ set: jest.fn(), delete: jest.fn() }),
}))
jest.spyOn(console, 'error').mockImplementation(() => undefined)

import { POST } from '../route'

const post = (email: string, ip: string, password = 'wrong-password') =>
  POST(
    new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: JSON.stringify({ email, password }),
    })
  )

beforeEach(() => {
  resetRateLimits()
  loginWithPassword.mockReset().mockResolvedValue({
    success: false,
    error: 'Invalid login credentials',
  })
})

describe('POST /api/auth/login — rate limiting (F-09)', () => {
  it('answers 401 for a wrong password while under the limits', async () => {
    const response = await post('owner@gym.test', '203.0.113.1')

    expect(response.status).toBe(401)
  })

  it('refuses the 6th attempt for one email with a 429, however many addresses it comes from', async () => {
    for (let n = 1; n <= 5; n += 1) {
      const response = await post('owner@gym.test', `203.0.113.${n}`)
      expect(response.status).toBe(401)
    }

    const sixth = await post('owner@gym.test', '203.0.113.99')

    expect(sixth.status).toBe(429)
    await expect(sixth.json()).resolves.toEqual({
      success: false,
      error: 'Too many sign-in attempts. Wait 15 minutes and try again.',
      errorCode: 'rate_limited',
    })
    // Refused before the password was even checked.
    expect(loginWithPassword).toHaveBeenCalledTimes(5)
  })

  it('treats the same email in a different case as the same email', async () => {
    for (let n = 1; n <= 5; n += 1) {
      await post('Owner@Gym.test', `203.0.113.${n}`)
    }

    const sixth = await post('owner@gym.test', '203.0.113.99')

    expect(sixth.status).toBe(429)
  })

  it('refuses the 11th attempt from one address with a 429, whatever the email', async () => {
    for (let n = 1; n <= 10; n += 1) {
      const response = await post(`user${n}@gym.test`, '198.51.100.7')
      expect(response.status).toBe(401)
    }

    const eleventh = await post('user11@gym.test', '198.51.100.7')

    expect(eleventh.status).toBe(429)
    expect((await eleventh.json()).errorCode).toBe('rate_limited')
  })

  it('leaves a different address and a different email unaffected', async () => {
    for (let n = 1; n <= 6; n += 1) {
      await post('owner@gym.test', '203.0.113.10')
    }

    const other = await post('someone-else@gym.test', '192.0.2.44')

    expect(other.status).toBe(401)
  })

  it('still accepts a correct password within the limits', async () => {
    loginWithPassword.mockResolvedValue({
      success: true,
      data: { requiresEmailVerification: false },
    })

    const response = await post('owner@gym.test', '203.0.113.1', 'right')

    expect(response.status).toBe(200)
  })
})
