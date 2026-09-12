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
