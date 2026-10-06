import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConsentingLeadRecipient,
  GymOwnerRecipient,
  IMarketingSource,
} from './IMarketingSource'

interface GymRow {
  id: string
  email: string
  gym_name: string
  subscription_status: string
}

interface LeadRow {
  email: string
  name: string
  gym_name: string | null
}

/**
 * Reads the mailing list's people from the app's tables. Needs the
 * service-role client: `leads` has no policy but the SaaS-admin read, and the
 * sync covers every gym, not one tenant.
 */
export class SupabaseMarketingSource implements IMarketingSource {
  constructor(private readonly supabase: SupabaseClient) {}

  async listGymOwners(): Promise<GymOwnerRecipient[]> {
    const { data, error } = await this.supabase
      .from('gyms')
      .select('id, email, gym_name, subscription_status')
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as GymRow[]).map((row) => ({
      gymId: row.id,
      email: row.email,
      gymName: row.gym_name,
      subscriptionStatus: row.subscription_status,
    }))
  }

  async listConsentingLeads(): Promise<ConsentingLeadRecipient[]> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('email, name, gym_name')
      .not('marketing_consent_at', 'is', null)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as LeadRow[]).map((row) => ({
      email: row.email,
      name: row.name,
      gymName: row.gym_name,
    }))
  }
}
