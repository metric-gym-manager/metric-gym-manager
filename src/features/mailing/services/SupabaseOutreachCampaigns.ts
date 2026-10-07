import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  IOutreachCampaigns,
  OutreachCampaignState,
} from './IOutreachCampaigns'

const TABLE = 'outreach_campaigns'

interface CampaignRow {
  paused_at: string | null
  pause_reason: string | null
  pause_alerted_at: string | null
  resumed_at: string | null
  last_summary_at: string | null
}

const date = (value: string | null) => (value ? new Date(value) : null)

/**
 * Campaign state in `outreach_campaigns`. Needs the SERVICE-ROLE client: the
 * table has RLS on and no policies. Every transition is a conditional update
 * that selects back what it changed — pause only while running, resume only
 * while paused, a summary only when the last is old enough — so of two
 * callers racing, exactly one wins, and a refused write cannot pass for one.
 */
export class SupabaseOutreachCampaigns implements IOutreachCampaigns {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly clock: () => Date = () => new Date()
  ) {}

  private stamp() {
    return this.clock().toISOString()
  }

  async state(campaign: string): Promise<OutreachCampaignState> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(
        'paused_at, pause_reason, pause_alerted_at, resumed_at, last_summary_at'
      )
      .eq('campaign', campaign)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const row = data as CampaignRow | null
    return {
      pausedAt: date(row?.paused_at ?? null),
      pauseReason: row?.pause_reason ?? null,
      pauseAlertedAt: date(row?.pause_alerted_at ?? null),
      resumedAt: date(row?.resumed_at ?? null),
      lastSummaryAt: date(row?.last_summary_at ?? null),
    }
  }

  async pause(
    campaign: string,
    reason: string,
    at: Date,
    alerted: boolean
  ): Promise<boolean> {
    await this.ensureRow(campaign)
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({
        paused_at: at.toISOString(),
        pause_reason: reason,
        pause_alerted_at: alerted ? at.toISOString() : null,
        updated_at: this.stamp(),
      })
      .eq('campaign', campaign)
      .is('paused_at', null)
      .select('campaign')
    if (error) throw new Error(error.message)
    return (data ?? []).length === 1
  }

  async markPauseAlerted(campaign: string, at: Date): Promise<void> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({ pause_alerted_at: at.toISOString(), updated_at: this.stamp() })
      .eq('campaign', campaign)
      .select('campaign')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      throw new Error(`No outreach campaign ${campaign} to update`)
    }
  }

  async resume(campaign: string, at: Date): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({
        paused_at: null,
        pause_reason: null,
        pause_alerted_at: null,
        resumed_at: at.toISOString(),
        updated_at: this.stamp(),
      })
      .eq('campaign', campaign)
      .not('paused_at', 'is', null)
      .select('campaign')
    if (error) throw new Error(error.message)
    return (data ?? []).length === 1
  }

  async claimSummary(
    campaign: string,
    at: Date,
    notSince: Date
  ): Promise<boolean> {
    await this.ensureRow(campaign)
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({ last_summary_at: at.toISOString(), updated_at: this.stamp() })
      .eq('campaign', campaign)
      .or(
        `last_summary_at.is.null,last_summary_at.lte.${notSince.toISOString()}`
      )
      .select('campaign')
    if (error) throw new Error(error.message)
    return (data ?? []).length === 1
  }

  /** A campaign's row, created running when there is none; an existing one is untouched. */
  private async ensureRow(campaign: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLE)
      .upsert({ campaign }, { onConflict: 'campaign', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }
}
