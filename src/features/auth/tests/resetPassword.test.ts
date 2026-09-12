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
const resetPasswordForEmail = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { verifyOtp, updateUser, signOut, resetPasswordForEmail },
  }),
}))

import { resetPassword, sendPasswordResetEmail } from '../services/auth.service'

const user = { id: 'u1', email: 'owner@gym.lk' }

beforeEach(() => {
  jest.clearAllMocks()
  verifyOtp.mockResolvedValue({ data: { user }, error: null })
  updateUser.mockResolvedValue({ error: null })
  signOut.mockResolvedValue({ error: null })
  resetPasswordForEmail.mockResolvedValue({ error: null })
})

/**
 * Where the emailed link points.
 *
 * This is the linchpin of the whole recovery fix and had NO test: `redirectTo`
 * becomes `{{ .RedirectTo }}` in the email template, so reverting it to
 * `/auth/callback` silently restores the defect — a link that verifies on GET,
 * which an email scanner spends before the recipient clicks. Mutation testing
 * found the gap: changing this value broke nothing.
 */
describe('sendPasswordResetEmail', () => {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP_URL
  })

  it('points the link at the form, not at the verifying callback', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.metricgymos.com'

    await sendPasswordResetEmail('owner@gym.lk')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('owner@gym.lk', {
      redirectTo: 'https://www.metricgymos.com/reset-password',
    })
    // `/auth/callback` verifies on GET. Recovery must not go through it.
    const [, opts] = resetPasswordForEmail.mock.calls[0]
    expect(opts.redirectTo).not.toContain('/auth/callback')
  })

  it('carries no query string, so every template can append with "?"', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.metricgymos.com'

    await sendPasswordResetEmail('owner@gym.lk')

    const [, opts] = resetPasswordForEmail.mock.calls[0]
    expect(opts.redirectTo).not.toContain('?')
  })

  it('falls back to localhost rather than building an undefined URL', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    await sendPasswordResetEmail('owner@gym.lk')

    const [, opts] = resetPasswordForEmail.mock.calls[0]
    expect(opts.redirectTo).toBe('http://localhost:3000/reset-password')
    expect(opts.redirectTo).not.toContain('undefined')
  })
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
