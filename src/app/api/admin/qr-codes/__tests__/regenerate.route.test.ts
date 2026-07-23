/**
 * @jest-environment node
 */

/**
 * Route tests for POST /api/admin/qr-codes/regenerate.
 * Covers authorization (403), input validation (400), and the happy path.
 */

const mockGetSaasAdmin = jest.fn()
const mockRotate = jest.fn()

jest.mock('@/lib/auth/requireSaasAdmin', () => ({
  getSaasAdmin: (...args: unknown[]) => mockGetSaasAdmin(...args),
}))

jest.mock('@/features/registration/services/registration-link.service', () => ({
  rotateRegistrationToken: (...args: unknown[]) => mockRotate(...args),
}))

import { POST } from '../regenerate/route'

function makeRequest(body: unknown): Request {
  return {
    json: async () => body,
  } as unknown as Request
}

const VALID_GYM_ID = '11111111-1111-1111-1111-111111111111'

describe('POST /api/admin/qr-codes/regenerate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-admins with 403 before touching the service', async () => {
    mockGetSaasAdmin.mockResolvedValue(null)

    const res = await POST(makeRequest({ gymId: VALID_GYM_ID }))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(mockRotate).not.toHaveBeenCalled()
  })

  it('rejects an invalid gymId with 400', async () => {
    mockGetSaasAdmin.mockResolvedValue({ id: 'admin-1', email: 'ops@x.com' })

    const res = await POST(makeRequest({ gymId: 'not-a-uuid' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(mockRotate).not.toHaveBeenCalled()
  })

  it('rotates the token and returns the new link for an admin', async () => {
    mockGetSaasAdmin.mockResolvedValue({ id: 'admin-1', email: 'ops@x.com' })
    const link = {
      token: 'abc123',
      joinUrl: 'https://app.example.com/join/abc123',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      rotatedAt: '2026-07-23T00:00:00Z',
    }
    mockRotate.mockResolvedValue(link)

    const res = await POST(makeRequest({ gymId: VALID_GYM_ID }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(link)
    expect(mockRotate).toHaveBeenCalledWith(VALID_GYM_ID)
  })

  it('returns 500 when rotation throws', async () => {
    mockGetSaasAdmin.mockResolvedValue({ id: 'admin-1', email: 'ops@x.com' })
    mockRotate.mockRejectedValue(new Error('boom'))

    const res = await POST(makeRequest({ gymId: VALID_GYM_ID }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
  })
})
