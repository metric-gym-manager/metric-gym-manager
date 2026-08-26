/**
 * Analytics feature factory.
 *
 * Composes the member-analytics read-model for API routes. Routes call the
 * factory with the appropriate Supabase client (session `createClient()` for
 * gym-scoped RLS); they never `new` the service directly (R7).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { MemberAnalyticsService } from './analytics.service'

export function createMemberAnalytics(
  supabase: SupabaseClient
): MemberAnalyticsService {
  return new MemberAnalyticsService(supabase)
}
