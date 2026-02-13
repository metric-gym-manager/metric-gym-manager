import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client with service role privileges.
 * This bypasses Row Level Security (RLS) and should ONLY be used server-side.
 *
 * Use cases:
 * - Creating user profiles during registration
 * - Admin operations that require bypassing RLS
 * - System-level operations
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
