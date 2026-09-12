/**
 * `resetPassword()` — where the one-time recovery token is spent.
 *
 * This is the security-critical half of the reset flow, and it had no test.
 * The ordering it guarantees is the whole point:
 *
 *   verifyOtp  ->  updateUser  ->  signOut
 *
 * `verifyOtp` FIRST, because a password must never be written on the strength
 * of an unverified token. `signOut` LAST, because the session verifyOtp creates
 * exists only to authorise the update and outlives the password it
 * authenticated.
 */
const verifyOtp = jest.fn()
const updateUser = jest.fn()
const signOut = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp, updateUser, signOut } }),
}))

import { resetPassword } from '../services/auth.service'

const user = { id: 'u1', email: 'owner@gym.lk' }

beforeEach(() => {
  jest.clearAllMocks()
  verifyOtp.mockResolvedValue({ data: { user }, error: null })
  updateUser.mockResolvedValue({ error: null })
  signOut.mockResolvedValue({ error: null })
})

describe('resetPassword', () => {
  it('spends the token, sets the password, then drops the session', async () => {
    const result = await resetPassword('tok_abc', 'Str0ngPassw0rd')

    expect(result.success).toBe(true)
    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'recovery',
      token_hash: 'tok_abc',
    })
    expect(updateUser).toHaveBeenCalledWith({ password: 'Str0ngPassw0rd' })
    expect(signOut).toHaveBeenCalled()

    // Order is the contract, not an accident of how it reads.
    expect(verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
      updateUser.mock.invocationCallOrder[0]
    )
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0]
    )
  })

  describe('a token that does not verify', () => {
    it('never writes a password when the token is rejected', async () => {
      verifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token has expired or is invalid' },
      })

      const result = await resetPassword('stale', 'Str0ngPassw0rd')

      expect(result.success).toBe(false)
      expect(updateUser).not.toHaveBeenCalled()
    })

    it('treats a success-shaped response with no user as a failure', async () => {
      // `verifyError || !data.user` — without the second half an empty success
      // falls through and dereferences a null user.
      verifyOtp.mockResolvedValue({ data: { user: null }, error: null })

      const result = await resetPassword('odd', 'Str0ngPassw0rd')

      expect(result.success).toBe(false)
      expect(updateUser).not.toHaveBeenCalled()
      // Asserting the EXACT message is what makes this test mean something.
      // With the guard removed the function still fails — but by crashing on
      // `data.user.email` and landing in the catch, which returns a different
      // message. Without this line the test passed against the mutation, i.e.
      // it was verifying the crash rather than the guard.
      expect(result.error).toBe(
        'Invalid or expired password reset link. Please request a new one.'
      )
    })

    it('does not leak the vendor message to the user (rule 2.8)', async () => {
      verifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'pq: relation "one_time_tokens" does not exist' },
      })

      const result = await resetPassword('stale', 'Str0ngPassw0rd')

      expect(result.error).toBe(
        'Invalid or expired password reset link. Please request a new one.'
      )
      expect(result.error).not.toContain('pq:')
    })
  })

  it('reports a failed update rather than claiming success', async () => {
    updateUser.mockResolvedValue({ error: { message: 'weak password' } })

    const result = await resetPassword('tok_abc', 'short')

    expect(result.success).toBe(false)
    // Nothing changed, so the user must not be signed out of a session they
    // may still need to retry with.
    expect(signOut).not.toHaveBeenCalled()
  })

  it('survives the client throwing', async () => {
    verifyOtp.mockRejectedValue(new Error('network down'))

    const result = await resetPassword('tok_abc', 'Str0ngPassw0rd')

    expect(result.success).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })
})
