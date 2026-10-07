import {
  OUTREACH_MAX_FAILURES,
  OUTREACH_SEQUENCE_LENGTH,
} from '../config/outreachCampaign'
import type {
  IOutreachCampaigns,
  OutreachCampaignState,
} from '../services/IOutreachCampaigns'
import type {
  IOutreachLedger,
  OutreachEventCounts,
  OutreachEventType,
  OutreachRecipient,
  OutreachStatus,
  OutreachStop,
  StopOptions,
} from '../services/IOutreachLedger'
import type {
  IOutreachSender,
  OutreachEmail,
} from '../services/IOutreachSender'
import type { IOwnerMailer, OwnerEmail } from '../services/IOwnerMailer'
import type { Prospect } from '../utils/prospectsCsv'

/**
 * In-memory outreach adapters with the observable behaviour of the real
 * ones: the ledger's conditional claim and status order, events written only
 * on a real change, a campaign paused by exactly one caller. Shared by every
 * outreach suite so they fake the ports the same way.
 */

export interface MemoryRow extends OutreachRecipient {
  campaign: string
  status: OutreachStatus
  source: string
  lastSentAt: Date | null
  failures: number
  resendEmailId?: string
  error?: string
}

export interface MemoryEvent {
  campaign: string
  email: string
  type: OutreachEventType
  step: number | null
  detail: string | null
  at: Date
}

const RANK: Record<OutreachStatus, number> = {
  active: 0,
  done: 1,
  failed: 1,
  unsubscribed: 2,
  bounced: 3,
  complained: 4,
}

export function emptyCounts(): OutreachEventCounts {
  return { sent: 0, unsubscribed: 0, bounced: 0, complained: 0, suppressed: 0 }
}

export class MemoryLedger implements IOutreachLedger {
  /** Keyed `${campaign}|${email}`; `rows.get(email)` reads the default campaign. */
  readonly all = new Map<string, MemoryRow>()
  readonly events: MemoryEvent[] = []
  clock: () => Date = () => new Date()

  constructor(private readonly defaultCampaign = 'intro-test') {}

  /** The default campaign's rows, keyed by email. */
  get rows(): Map<string, MemoryRow> {
    return new Map(
      [...this.all.values()]
        .filter((r) => r.campaign === this.defaultCampaign)
        .map((r) => [r.email, r])
    )
  }

  private row(campaign: string, email: string) {
    return this.all.get(`${campaign}|${email}`)
  }

  async addRecipients(
    campaign: string,
    prospects: Prospect[],
    defaultSource: string
  ) {
    const added: string[] = []
    for (const p of prospects) {
      if (this.row(campaign, p.email)) continue
      this.all.set(`${campaign}|${p.email}`, {
        campaign,
        email: p.email,
        gymName: p.gymName,
        name: p.name,
        step: 0,
        status: 'active',
        source: p.source ?? defaultSource,
        lastSentAt: null,
        failures: 0,
      })
      added.push(p.email)
    }
    return added
  }

  async recipients(campaign: string) {
    return new Map(
      [...this.all.values()]
        .filter((r) => r.campaign === campaign)
        .map((r) => [r.email, r.status])
    )
  }

  async due(campaign: string, notSentSince: Date, limit: number) {
    return [...this.all.values()]
      .filter(
        (r) =>
          r.campaign === campaign &&
          r.status === 'active' &&
          r.step < OUTREACH_SEQUENCE_LENGTH &&
          (r.lastSentAt === null || r.lastSentAt <= notSentSince)
      )
      .slice(0, limit)
      .map(({ email, gymName, name, step }) => ({ email, gymName, name, step }))
  }

  async claim(campaign: string, email: string, fromStep: number, at: Date) {
    const r = this.row(campaign, email)
    if (!r || r.status !== 'active' || r.step !== fromStep) return false
    r.step = fromStep + 1
    r.lastSentAt = at
    return true
  }

  async recordSent(
    campaign: string,
    email: string,
    step: number,
    resendEmailId: string
  ) {
    const r = this.row(campaign, email)!
    r.resendEmailId = resendEmailId
    r.failures = 0
    if (step >= OUTREACH_SEQUENCE_LENGTH) r.status = 'done'
    this.events.push({
      campaign,
      email,
      type: 'sent',
      step,
      detail: null,
      at: this.clock(),
    })
  }

  async recordFailure(
    campaign: string,
    email: string,
    revertTo: number,
    error: string
  ) {
    const r = this.row(campaign, email)!
    r.step = revertTo
    r.error = error
    r.failures += 1
    if (r.failures >= OUTREACH_MAX_FAILURES) r.status = 'failed'
  }

  async markDone(campaign: string, email: string) {
    const r = this.row(campaign, email)
    if (r) r.status = 'done'
  }

  async stop(email: string, status: OutreachStop, options: StopOptions = {}) {
    const changed: string[] = []
    for (const r of this.all.values()) {
      if (r.email !== email) continue
      if (options.campaign && r.campaign !== options.campaign) continue
      if (RANK[r.status] >= RANK[status]) continue
      r.status = status
      changed.push(r.campaign)
      this.events.push({
        campaign: r.campaign,
        email,
        type: options.event ?? status,
        step: r.step,
        detail: options.detail ?? null,
        at: this.clock(),
      })
    }
    return changed
  }

  async eventCounts(campaign: string, since: Date) {
    const counts = emptyCounts()
    for (const e of this.events) {
      if (e.campaign === campaign && e.at >= since) counts[e.type] += 1
    }
    return counts
  }

  async progress(campaign: string) {
    return [...this.all.values()]
      .filter((r) => r.campaign === campaign)
      .map(({ status, step }) => ({ status, step }))
  }
}

export class MemoryCampaigns implements IOutreachCampaigns {
  readonly states = new Map<string, OutreachCampaignState>()

  private get_(campaign: string): OutreachCampaignState {
    let s = this.states.get(campaign)
    if (!s) {
      s = {
        pausedAt: null,
        pauseReason: null,
        pauseAlertedAt: null,
        resumedAt: null,
        lastSummaryAt: null,
      }
      this.states.set(campaign, s)
    }
    return s
  }

  async state(campaign: string) {
    return { ...this.get_(campaign) }
  }

  async pause(campaign: string, reason: string, at: Date, alerted: boolean) {
    const s = this.get_(campaign)
    if (s.pausedAt) return false
    s.pausedAt = at
    s.pauseReason = reason
    s.pauseAlertedAt = alerted ? at : null
    return true
  }

  async markPauseAlerted(campaign: string, at: Date) {
    this.get_(campaign).pauseAlertedAt = at
  }

  async resume(campaign: string, at: Date) {
    const s = this.get_(campaign)
    if (!s.pausedAt) return false
    s.pausedAt = null
    s.pauseReason = null
    s.pauseAlertedAt = null
    s.resumedAt = at
    return true
  }

  async claimSummary(campaign: string, at: Date, notSince: Date) {
    const s = this.get_(campaign)
    if (s.lastSummaryAt && s.lastSummaryAt > notSince) return false
    s.lastSummaryAt = at
    return true
  }
}

export class FakeOwnerMailer implements IOwnerMailer {
  readonly sent: OwnerEmail[] = []
  readonly forwarded: string[] = []
  failSends = false

  async send(email: OwnerEmail) {
    if (this.failSends) throw new Error('Resend is down')
    // Resend's idempotency: one email per key.
    if (!this.sent.some((e) => e.idempotencyKey === email.idempotencyKey)) {
      this.sent.push(email)
    }
    return `owner_${this.sent.length}`
  }

  async forward(receivedEmailId: string) {
    this.forwarded.push(receivedEmailId)
    return `fwd_${this.forwarded.length}`
  }
}

export class FakeSender implements IOutreachSender {
  contacts = new Map<string, string>()
  unreachable = new Set<string>()
  failFor = new Set<string>()
  checkFails = new Set<string>()
  sent: OutreachEmail[] = []
  /** Runs after each send: a webhook arriving mid-run. */
  afterSend: (email: OutreachEmail) => Promise<void> = async () => {}

  async ensureContact(email: string, token: string) {
    if (!this.contacts.has(email)) this.contacts.set(email, token)
  }
  async canReceiveMarketing(email: string) {
    if (this.checkFails.has(email)) throw new Error('Resend is down')
    return !this.unreachable.has(email)
  }
  async send(email: OutreachEmail) {
    if (this.failFor.has(email.to)) throw new Error('Resend said no')
    this.sent.push(email)
    await this.afterSend(email)
    return `em_${this.sent.length}`
  }
  stepsTo(address: string) {
    return this.sent
      .filter((e) => e.to === address)
      .map((e) => e.tags.find((t) => t.name === 'email')?.value)
  }
}
