import type { SupabaseClient } from '@supabase/supabase-js'
import {
  OUTREACH_MAX_FAILURES,
  OUTREACH_SEQUENCE_LENGTH,
} from '../config/outreachCampaign'
import type { Prospect } from '../utils/prospectsCsv'
import type {
  IOutreachLedger,
  OutreachEventCounts,
  OutreachEventType,
  OutreachRecipient,
  OutreachStatus,
  OutreachStop,
  StopOptions,
} from './IOutreachLedger'

const TABLE = 'outreach_recipients'
const EVENTS = 'outreach_events'

/** A stop moves a row only from a weaker status, never back from a stronger one. */
const WEAKER: Record<OutreachStop, OutreachStatus[]> = {
  unsubscribed: ['active', 'done', 'failed'],
  bounced: ['active', 'done', 'failed', 'unsubscribed'],
  complained: ['active', 'done', 'failed', 'unsubscribed', 'bounced'],
}

/**
 * The outreach ledger in `outreach_recipients`. Needs the SERVICE-ROLE
 * client: the table has RLS on and no policies. Every write selects back what
 * it wrote, so a refused write cannot pass for one (the rule 2.7 lesson), and
 * a step is claimed with a conditional update — `step` must still be the one
 * read — so two runs can never send the same email twice. Events go to
 * `outreach_events` (also no policies): one per send, and one per stop that
 * actually changed a row.
 */
export class SupabaseOutreachLedger implements IOutreachLedger {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly clock: () => Date = () => new Date()
  ) {}

  private stamp() {
    return this.clock().toISOString()
  }

  async addRecipients(
    campaign: string,
    prospects: Prospect[],
    defaultSource: string
  ): Promise<string[]> {
    if (prospects.length === 0) return []
    const { data, error } = await this.supabase
      .from(TABLE)
      .upsert(
        prospects.map((p) => ({
          campaign,
          email: p.email,
          gym_name: p.gymName,
          name: p.name,
          source: p.source ?? defaultSource,
        })),
        { onConflict: 'campaign,email', ignoreDuplicates: true }
      )
      .select('email')
    if (error) throw new Error(error.message)
    return ((data ?? []) as { email: string }[]).map((row) => row.email)
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

  async due(
    campaign: string,
    notSentSince: Date,
    limit: number
  ): Promise<OutreachRecipient[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('email, gym_name, name, step')
      .eq('campaign', campaign)
      .eq('status', 'active')
      .lt('step', OUTREACH_SEQUENCE_LENGTH)
      .or(`last_sent_at.is.null,last_sent_at.lte.${notSentSince.toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (
      (data ?? []) as {
        email: string
        gym_name: string | null
        name: string | null
        step: number
      }[]
    ).map((row) => ({
      email: row.email,
      gymName: row.gym_name,
      name: row.name,
      step: row.step,
    }))
  }

  async claim(
    campaign: string,
    email: string,
    fromStep: number,
    at: Date
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({
        step: fromStep + 1,
        last_sent_at: at.toISOString(),
        updated_at: this.stamp(),
      })
      .eq('campaign', campaign)
      .eq('email', email)
      .eq('step', fromStep)
      .eq('status', 'active')
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length === 1
  }

  async recordSent(
    campaign: string,
    email: string,
    step: number,
    resendEmailId: string
  ): Promise<void> {
    await this.write(campaign, email, {
      resend_email_id: resendEmailId,
      error: null,
      failures: 0,
      updated_at: this.stamp(),
      ...(step >= OUTREACH_SEQUENCE_LENGTH ? { status: 'done' } : {}),
    })
    await this.insertEvents({
      campaign,
      email,
      type: 'sent',
      step,
      detail: null,
      created_at: this.stamp(),
    })
  }

  async recordFailure(
    campaign: string,
    email: string,
    revertTo: number,
    message: string
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('failures')
      .eq('campaign', campaign)
      .eq('email', email)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const failures = ((data as { failures: number } | null)?.failures ?? 0) + 1
    await this.write(campaign, email, {
      step: revertTo,
      error: message,
      failures,
      updated_at: this.stamp(),
      ...(failures >= OUTREACH_MAX_FAILURES ? { status: 'failed' } : {}),
    })
  }

  async markDone(campaign: string, email: string): Promise<void> {
    await this.write(campaign, email, {
      status: 'done',
      updated_at: this.stamp(),
    })
  }

  async stop(
    email: string,
    status: OutreachStop,
    options: StopOptions = {}
  ): Promise<string[]> {
    let query = this.supabase
      .from(TABLE)
      .update({ status, updated_at: this.stamp() })
      .eq('email', email)
    if (options.campaign) query = query.eq('campaign', options.campaign)
    const { data, error } = await query
      .in('status', WEAKER[status])
      .select('campaign, step')
    if (error) throw new Error(error.message)
    const changed = (data ?? []) as { campaign: string; step: number }[]
    if (changed.length > 0) {
      const at = this.stamp()
      await this.insertEvents(
        changed.map((row) => ({
          campaign: row.campaign,
          email,
          type: options.event ?? status,
          step: row.step,
          detail: options.detail ?? null,
          created_at: at,
        }))
      )
    }
    return changed.map((row) => row.campaign)
  }

  async eventCounts(
    campaign: string,
    since: Date
  ): Promise<OutreachEventCounts> {
    const { data, error } = await this.supabase
      .from(EVENTS)
      .select('type')
      .eq('campaign', campaign)
      .gte('created_at', since.toISOString())
    if (error) throw new Error(error.message)
    const counts: OutreachEventCounts = {
      sent: 0,
      unsubscribed: 0,
      bounced: 0,
      complained: 0,
      suppressed: 0,
    }
    for (const row of (data ?? []) as { type: OutreachEventType }[]) {
      if (row.type in counts) counts[row.type] += 1
    }
    return counts
  }

  async progress(
    campaign: string
  ): Promise<{ status: OutreachStatus; step: number }[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('status, step')
      .eq('campaign', campaign)
    if (error) throw new Error(error.message)
    return (data ?? []) as { status: OutreachStatus; step: number }[]
  }

  private async insertEvents(
    rows: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<void> {
    const { error } = await this.supabase.from(EVENTS).insert(rows)
    if (error) throw new Error(error.message)
  }

  private async write(
    campaign: string,
    email: string,
    values: Record<string, unknown>
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update(values)
      .eq('campaign', campaign)
      .eq('email', email)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      throw new Error(`No outreach recipient ${email} in ${campaign} to update`)
    }
  }
}
