import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Create a Supabase client for browser use
 * This client is used in client components and pages
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
