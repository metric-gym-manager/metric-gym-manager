import type { SupabaseClient } from '@supabase/supabase-js'
import type { Prospect } from '../utils/prospectsCsv'
import type {
  IOutreachLedger,
  OutreachPatch,
  OutreachStatus,
} from './IOutreachLedger'

const TABLE = 'outreach_recipients'

/**
 * The outreach ledger in `outreach_recipients`. Needs the SERVICE-ROLE
 * client: the table has RLS on and no policies, and every write selects back
 * what it wrote, so a refused write cannot pass for one (the rule 2.7 lesson).
 */
export class SupabaseOutreachLedger implements IOutreachLedger {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async addRecipients(
    campaign: string,
    prospects: Prospect[],
    source: string
  ): Promise<number> {
    if (prospects.length === 0) return 0
    const { data, error } = await this.supabase
      .from(TABLE)
      .upsert(
        prospects.map((p) => ({
          campaign,
          email: p.email,
          gym_name: p.gymName,
          name: p.name,
          source,
        })),
        { onConflict: 'campaign,email', ignoreDuplicates: true }
      )
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length
  }

  async recipients(campaign: string): Promise<Map<string, OutreachStatus>> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('email, status')
      .eq('campaign', campaign)
    if (error) throw new Error(error.message)
    return new Map(
      ((data ?? []) as { email: string; status: OutreachStatus }[]).map(
        (row) => [row.email, row.status]
      )
    )
  }

  async pending(campaign: string, limit: number): Promise<Prospect[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('email, gym_name, name')
      .eq('campaign', campaign)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (
      (data ?? []) as {
        email: string
        gym_name: string | null
        name: string | null
      }[]
    ).map((row) => ({
      email: row.email,
      gymName: row.gym_name,
      name: row.name,
    }))
  }

  async mark(
    campaign: string,
    email: string,
    patch: OutreachPatch
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({
        status: patch.status,
        resend_email_id: patch.resendEmailId ?? null,
        error: patch.error ?? null,
        updated_at: this.clock().toISOString(),
      })
      .eq('campaign', campaign)
      .eq('email', email)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      throw new Error(`No outreach recipient ${email} in ${campaign} to update`)
    }
  }
}
