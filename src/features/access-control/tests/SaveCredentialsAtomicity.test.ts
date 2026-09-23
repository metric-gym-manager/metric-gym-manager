/**
 * A credential save that fails must leave nothing behind.
 *
 * Found in production on 2026-09-23. The deployed encryption key was malformed
 * (21 bytes, not 32), so `encryptSecret` threw — but only AFTER the account row
 * had been written. A real gym was left with an access-control account marked
 * active, pointing at a vendor, holding no credentials at all.
 *
 * The existing guard deactivated the row when the *secret write* failed. It
 * could not help here, because the throw happened while preparing the values,
 * before that write was ever attempted. Encrypting first removes the window
 * entirely: a key problem now fails before anything is stored.
 */

import { SupabaseAccessControlRepository } from '@/features/access-control/services/SupabaseAccessControlRepository'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Records every table written to, so an orphan row is visible. */
function makeClient(touched: string[]) {
  const builder = {
    upsert: () => ({
      select: () => ({
        single: async () => ({
          data: { id: 'acct-1', gym_id: 'gym-1' },
          error: null,
        }),
      }),
      then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
    }),
    update: () => builder,
    eq: () => builder,
  }

  return {
    from: (table: string) => {
      touched.push(table)
      return builder
    },
  } as unknown as SupabaseClient
}

describe('saveCredentials with an unusable encryption key', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ACCESS_CONTROL_ENCRYPTION_KEY: 'dG9vLXNob3J0',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('writes no account row when the key cannot be used', async () => {
    const touched: string[] = []
    const repo = new SupabaseAccessControlRepository(makeClient(touched))

    await expect(
      repo.saveCredentials('gym-1', {
        baseUrl: 'https://acccloudlk.com',
        email: 'installer@example.com',
        password: 'secret',
      })
    ).rejects.toThrow()

    // The whole point: no half-configured account left claiming to be set up.
    expect(touched).not.toContain('access_control_accounts')
  })
})
