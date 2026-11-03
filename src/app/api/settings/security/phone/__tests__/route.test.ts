/**
 * @jest-environment node
 */

/**
 * POST /api/settings/security/phone — the gym owner's own phone number, saved
 * directly by the signed-in owner. No one-time code: the session is the proof.
 */

import { NextRequest } from 'next/server'

const updateGymPhone = jest.fn()
const getCurrentGymProfile = jest.fn()

jest.mock('@/lib/middleware/auth', () => ({
  getCurrentGymProfile: () => getCurrentGymProfile(),
}))
jest.mock('@/features/settings/services/settings.service', () => ({
  updateGymPhone: (...args: unknown[]) => updateGymPhone(...args),
}))

import { POST } from '../route'

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/settings/security/phone', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  updateGymPhone.mockReset()
  getCurrentGymProfile.mockReset()
  getCurrentGymProfile.mockResolvedValue({ id: 'gym-1', gym_name: 'Titan' })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('POST /api/settings/security/phone', () => {
  it('saves the number in its stored +94 form for the session’s gym', async () => {
    updateGymPhone.mockResolvedValue({
      status: 'ok',
      profile: { id: 'gym-1', phone_number: '+94771234567' },
    })

    const res = await post({ phone_number: '077 123 4567' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(updateGymPhone).toHaveBeenCalledWith('gym-1', '+94771234567')
    expect(body.success).toBe(true)
    expect(body.data.phone_number).toBe('+94771234567')
  })

  it('refuses a number that is not a Sri Lankan mobile (400) and saves nothing', async () => {
    const res = await post({ phone_number: '0112345678' })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details.errors.phone_number).toEqual([
      'Invalid Sri Lankan mobile number. Use format: 0771234567',
    ])
    expect(updateGymPhone).not.toHaveBeenCalled()
  })

  it('refuses a body with no number (400)', async () => {
    const res = await post({})

    expect(res.status).toBe(400)
    expect(updateGymPhone).not.toHaveBeenCalled()
  })

  it('refuses a caller with no session (401) and saves nothing', async () => {
    getCurrentGymProfile.mockRejectedValue(new Error('Unauthorized'))

    const res = await post({ phone_number: '0771234567' })

    expect(res.status).toBe(401)
    expect(updateGymPhone).not.toHaveBeenCalled()
  })

  it('answers 409 when another gym already uses the number', async () => {
    updateGymPhone.mockResolvedValue({ status: 'taken' })

    const res = await post({ phone_number: '0771234567' })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe(
      'This phone number is already used by another gym account.'
    )
  })

  it('answers 500 when the save fails', async () => {
    updateGymPhone.mockResolvedValue({ status: 'error' })

    const res = await post({ phone_number: '0771234567' })

    expect(res.status).toBe(500)
    expect((await res.json()).success).toBe(false)
  })
})
