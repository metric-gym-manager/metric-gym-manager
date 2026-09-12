/**
 * `updateEmail` — requesting a change of the account email address.
 *
 * The behaviour pinned here is what the function does NOT do: it must not write
 * the new address into the `gyms` row.
 *
 * It used to, optimistically, the moment the change was requested. Supabase runs
 * with `double_confirm_changes`, so the change is not real until both the old
 * and the new address confirm — and until then the true current address lives in
 * `user.email`, not in our row. Writing early produced three defects, all of
 * which reached production:
 *
 *   1. `gyms.email` and `user.new_email` held the SAME value, so the settings
 *      banner named the new address twice: "sent to X, and the one sent to X".
 *   2. The row advertised an address the user could not yet sign in with.
 *   3. Abandoning the change left `email_verified: false` permanently, flagging
 *      an account whose email was never in question.
 *
 * `/auth/callback` writes both fields when the change completes, which is the
 * only moment either is known.
 */
const getUser = jest.fn()
const updateUser = jest.fn()
const single = jest.fn()
const gymsUpdate = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser, updateUser },
    from: () => ({
      select: () => ({
        eq: () => ({ neq: () => ({ single }) }),
      }),
      update: (patch: unknown) => {
        gymsUpdate(patch)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

import { updateEmail } from '../services/auth.service'

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({
    data: { user: { id: 'u1', email: 'old@gym.lk' } },
    error: null,
  })
  // No other gym already owns the address.
  single.mockResolvedValue({ data: null, error: null })
  updateUser.mockResolvedValue({ error: null })
})

describe('updateEmail', () => {
  it('asks Supabase to change the address', async () => {
    const result = await updateEmail('new@gym.lk')

    expect(result.success).toBe(true)
    expect(updateUser).toHaveBeenCalledWith(
      { email: 'new@gym.lk' },
      expect.objectContaining({
        emailRedirectTo: expect.stringContaining('/auth/callback'),
      })
    )
  })

  it('does NOT write the new address into the gyms row', async () => {
    // The heart of it. Writing here is what made the banner print one address
    // twice, because `pending_email` and `gyms.email` became the same value.
    await updateEmail('new@gym.lk')

    expect(gymsUpdate).not.toHaveBeenCalled()
  })

  it('does NOT mark the account unverified for a change that may be abandoned', async () => {
    await updateEmail('new@gym.lk')

    const patches = gymsUpdate.mock.calls.map((c) => c[0])
    expect(patches).not.toContainEqual(
      expect.objectContaining({ email_verified: false })
    )
  })

  it('refuses an address another gym already holds', async () => {
    single.mockResolvedValue({ data: { id: 'g2' }, error: null })

    const result = await updateEmail('taken@gym.lk')

    expect(result.success).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
    expect(gymsUpdate).not.toHaveBeenCalled()
  })

  /**
   * Reported from production: submitting the address the account already holds
   * showed a green "sent" message and no email ever arrived.
   *
   * Supabase accepts it — the project's auth logs show `PUT /user 200
   * user_modified` for exactly this, with no `/verify` traffic afterwards —
   * because there is nothing to change and so nothing to confirm. The old code
   * saw no error and ran its success path, promising mail that was never going
   * to be sent. The "already in use" lookup could not catch it either: it
   * excludes the current user by design (`.neq('user_id', user.id)`).
   */
  it('refuses the address the account already holds', async () => {
    const result = await updateEmail('old@gym.lk')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/already your email address/i)
    // Nothing may be asked of Supabase: the request is a no-op by definition.
    expect(updateUser).not.toHaveBeenCalled()
  })

  it.each([
    ['different capitalisation', 'OLD@Gym.LK'],
    ['surrounding whitespace', '  old@gym.lk  '],
  ])('treats %s as the same address', async (_name, typed) => {
    // Supabase stores addresses lowercased, so these are the same mailbox.
    const result = await updateEmail(typed)

    expect(result.success).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  /**
   * `updateUser` returns once the change is RECORDED. The SMTP send happens
   * afterwards and its failure never reaches this function, so the message must
   * not assert delivery — it is the one thing this code path cannot know.
   */
  it('does not claim mail was delivered', async () => {
    const result = await updateEmail('new@gym.lk')

    expect(result.success).toBe(true)
    const message = (result.data as { message: string }).message
    expect(message).not.toMatch(/\bsent\b/i)
    expect(message).toMatch(/on their way|check spam/i)
  })

  it('reports a rejection from Supabase rather than claiming success', async () => {
    updateUser.mockResolvedValue({ error: { message: 'rate limited' } })

    const result = await updateEmail('new@gym.lk')

    expect(result.success).toBe(false)
    expect(gymsUpdate).not.toHaveBeenCalled()
  })

  it('refuses without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await updateEmail('new@gym.lk')

    expect(result.success).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })
})
