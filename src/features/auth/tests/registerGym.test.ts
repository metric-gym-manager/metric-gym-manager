/**
 * `registerGym()` — what a failed Supabase sign-up shows the visitor.
 *
 * On 2026-10-05 every sign-up failed because Gmail refused the SMTP login, and
 * /register printed Supabase's own "Error sending confirmation email" (rule
 * 2.8: sanitize technical detail before display). The raw message belongs in
 * the server log, not in `result.error`.
 */
const signUp = jest.fn()
const single = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
    }),
    auth: { signUp },
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('no gym row may be written after a failed sign-up')
  },
}))

import { registerGym } from '../services/auth.service'
import { describeRegistrationError } from '../utils/registrationError'

const input = {
  username: 'ironhouse',
  email: 'owner@ironhouse.lk',
  password: 'Str0ngPassword',
  confirmPassword: 'Str0ngPassword',
  gymName: 'Iron House',
  gymAddress: '',
  gymWebsite: '',
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
  // Neither the username nor the email is taken.
  single.mockResolvedValue({ data: null, error: null })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('registerGym when Supabase refuses the sign-up', () => {
  it('returns the plain message, never the SMTP failure text', async () => {
    const authError = {
      name: 'AuthApiError',
      status: 500,
      code: 'unexpected_failure',
      message: 'Error sending confirmation email',
    }
    signUp.mockResolvedValue({ data: { user: null }, error: authError })

    const result = await registerGym(input)

    expect(result.success).toBe(false)
    expect(result.error).toBe(describeRegistrationError(authError))
    expect(result.error).not.toMatch(/confirmation email/i)
    // The raw detail is still recorded server-side.
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      'Error sending confirmation email'
    )
  })

  it('still reports an address that is already registered', async () => {
    signUp.mockResolvedValue({
      data: { user: null },
      error: {
        code: 'user_already_exists',
        message: 'User already registered',
      },
    })

    const result = await registerGym(input)

    expect(result).toEqual({
      success: false,
      error: 'Email already registered',
    })
  })
})
