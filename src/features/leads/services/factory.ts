/**
 * Leads feature factory.
 *
 * Composes the lead use-cases for API routes (R7). The public lead route is
 * anonymous, so it passes the service-role `createAdminClient()` — writes
 * bypass RLS on the deny-by-default `leads` table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ILeadRepository } from './ILeadRepository'
import { SupabaseLeadRepository } from './SupabaseLeadRepository'
import { SubmitLead } from './SubmitLead'

export function createLeadRepository(
  supabase: SupabaseClient
): ILeadRepository {
  return new SupabaseLeadRepository(supabase)
}

export function createSubmitLead(supabase: SupabaseClient): SubmitLead {
  return new SubmitLead(createLeadRepository(supabase))
}
