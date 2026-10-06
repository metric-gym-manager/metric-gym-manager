import { MailingAudience } from '../config/MailingConfig'
import { normalizeMailingEmail } from '../utils/unsubscribeToken'
import type { AddMarketingContact } from './AddMarketingContact'
import { audiencesForGym } from './eligibility'
import type { AddContactResult, IMailingList } from './IMailingList'
import type { IMarketingSource } from './IMarketingSource'

export interface SyncMarketingContactsOptions {
  /** False reports what would happen and writes nothing. */
  apply: boolean
  /** Test and E2E gyms, which must never receive email. */
  excludeGymIds: string[]
  excludeEmails: string[]
}

export interface SyncReportEntry {
  email: string
  action: 'exclude' | 'move' | 'remove' | 'leave_updates' | 'add'
  audience?: MailingAudience
  outcome: AddContactResult | 'planned' | 'done' | 'excluded' | 'failed'
  /** For a move: the address it moved from. */
  from?: string
  error?: string
}

/**
 * Top-level domains reserved by RFC 2606 / RFC 6761, plus mDNS `.local`: an
 * address there can never receive mail. A send to one hard-bounces, and
 * bounces cost the sending domain reputation, so they are never imported.
 */
const UNDELIVERABLE_TLDS = ['test', 'example', 'invalid', 'localhost', 'local']

function isUndeliverable(email: string): boolean {
  const domain = email.split('@')[1] ?? ''
  const tld = domain.split('.').pop() ?? ''
  return UNDELIVERABLE_TLDS.includes(tld)
}

/** One person the list should hold, keyed by lowercased email. */
interface Wanted {
  email: string
  name?: string
  gymName?: string
  gymId?: string
  audiences: Set<MailingAudience>
}

const AUDIENCES = [MailingAudience.Marketing, MailingAudience.ProductUpdates]

/**
 * Reconcile the Resend mailing list with the app (owner decisions of
 * 2026-10-06). The two audiences are ELIGIBILITY; the topics are each
 * person's CHOICE, and this never writes a topic except to carry opt-outs to
 * a gym's new address:
 * - every gym and every consenting lead is in Marketing;
 * - a gym with a current subscription is also in Product updates, and leaves
 *   it when it cancels or is suspended (`audiencesForGym`);
 * - a gym whose email changed MOVES: a contact is made at the new address in
 *   the gym's audiences, every opted-out topic is copied onto it, and only
 *   then is the old contact deleted — found through its `gym_id` property;
 * - an address that is nobody's any more (a deleted gym, an exclusion) is
 *   taken off both audiences, not deleted, so its opt-outs are kept.
 *
 * Steady state costs two list calls: everything is decided against the
 * prefetched membership. One failure is recorded and the rest carry on.
 */
export class SyncMarketingContacts {
  constructor(
    private readonly source: IMarketingSource,
    private readonly list: IMailingList,
    private readonly addContact: AddMarketingContact
  ) {}

  /**
   * @param options - Whether to write, and who to leave out
   * @returns One entry per decision, in the order taken
   */
  async execute(
    options: SyncMarketingContactsOptions
  ): Promise<SyncReportEntry[]> {
    const report: SyncReportEntry[] = []
    const { wanted, byGym } = await this.wantedList(options, report)

    // Current membership, keyed by lowercased email; values as stored.
    const members = new Map<MailingAudience, Map<string, string>>()
    const stored = new Map<string, string>()
    for (const audience of AUDIENCES) {
      const emails = await this.list.listAudience(audience)
      const byLower = new Map(emails.map((e) => [normalizeMailingEmail(e), e]))
      members.set(audience, byLower)
      for (const [lower, asStored] of byLower) stored.set(lower, asStored)
    }
    const isMember = (lower: string, audience: MailingAudience) =>
      members.get(audience)?.has(lower) ?? false

    const step = async (
      entry: Omit<SyncReportEntry, 'outcome'>,
      write: () => Promise<SyncReportEntry['outcome'] | void>
    ) => {
      if (!options.apply) {
        report.push({ ...entry, outcome: 'planned' })
        return
      }
      try {
        report.push({ ...entry, outcome: (await write()) || 'done' })
      } catch (error) {
        report.push({
          ...entry,
          outcome: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // 1. Members who are nobody's address: a gym that moved, or gone.
    for (const [lower, asStored] of [...stored]) {
      if (wanted.has(lower)) continue
      const gymId = await this.list.getGymId(asStored)
      const target = gymId ? byGym.get(gymId) : undefined
      if (target) {
        await step(
          { email: target.email, action: 'move', from: asStored },
          async () => {
            const at = stored.get(target.email)
            for (const audience of target.audiences) {
              if (!isMember(target.email, audience)) {
                await this.add(target, audience, at)
              }
            }
            const optedOut = await this.list.optedOutTopics(asStored)
            if (optedOut.length > 0) {
              await this.list.optOut(at ?? target.email, optedOut)
            }
            await this.list.deleteContact(asStored)
          }
        )
        // The move put the new address in its audiences (or would have).
        for (const audience of target.audiences) {
          const atAudience = members.get(audience)
          if (atAudience && !atAudience.has(target.email)) {
            atAudience.set(target.email, target.email)
          }
        }
        continue
      }
      for (const audience of AUDIENCES) {
        if (!isMember(lower, audience)) continue
        await step({ email: asStored, action: 'remove', audience }, () =>
          this.list.removeFromAudience(asStored, audience)
        )
      }
    }

    // 2. Product updates is for current subscriptions only.
    const updates = members.get(MailingAudience.ProductUpdates) ?? new Map()
    for (const [lower, asStored] of updates) {
      const person = wanted.get(lower)
      if (!person || person.audiences.has(MailingAudience.ProductUpdates)) {
        continue
      }
      await step(
        {
          email: asStored,
          action: 'leave_updates',
          audience: MailingAudience.ProductUpdates,
        },
        () =>
          this.list.removeFromAudience(asStored, MailingAudience.ProductUpdates)
      )
    }

    // 3. Everyone wanted, in every audience they belong to.
    for (const [lower, person] of wanted) {
      for (const audience of person.audiences) {
        if (isMember(lower, audience)) continue
        await step(
          { email: stored.get(lower) ?? person.email, action: 'add', audience },
          () => this.add(person, audience, stored.get(lower))
        )
      }
    }

    return report
  }

  private add(
    person: Wanted,
    audience: MailingAudience,
    storedEmail: string | undefined
  ): Promise<AddContactResult> {
    return this.addContact.execute({
      email: person.email,
      ...(storedEmail ? { storedEmail } : {}),
      name: person.name,
      gymName: person.gymName,
      ...(person.gymId ? { gymId: person.gymId } : {}),
      audience,
    })
  }

  /** Who the list should hold, after exclusions. */
  private async wantedList(
    options: SyncMarketingContactsOptions,
    report: SyncReportEntry[]
  ): Promise<{ wanted: Map<string, Wanted>; byGym: Map<string, Wanted> }> {
    const excludedIds = new Set(options.excludeGymIds)
    const excludedEmails = new Set(
      options.excludeEmails.map(normalizeMailingEmail)
    )
    const wanted = new Map<string, Wanted>()
    const byGym = new Map<string, Wanted>()
    const excluded = new Set<string>()
    const exclude = (email: string) => {
      if (excluded.has(email)) return
      excluded.add(email)
      report.push({ email, action: 'exclude', outcome: 'excluded' })
    }
    const entry = (email: string): Wanted => {
      const existing = wanted.get(email)
      if (existing) return existing
      const created: Wanted = { email, audiences: new Set() }
      wanted.set(email, created)
      return created
    }

    for (const owner of await this.source.listGymOwners()) {
      const email = normalizeMailingEmail(owner.email)
      if (
        excludedIds.has(owner.gymId) ||
        excludedEmails.has(email) ||
        isUndeliverable(email)
      ) {
        exclude(email)
        continue
      }
      const person = entry(email)
      person.gymId = owner.gymId
      person.gymName = owner.gymName
      for (const audience of audiencesForGym(owner.subscriptionStatus)) {
        person.audiences.add(audience)
      }
      byGym.set(owner.gymId, person)
    }

    for (const lead of await this.source.listConsentingLeads()) {
      const email = normalizeMailingEmail(lead.email)
      if (
        excluded.has(email) ||
        excludedEmails.has(email) ||
        isUndeliverable(email)
      ) {
        exclude(email)
        continue
      }
      const person = entry(email)
      person.name ??= lead.name
      person.gymName ??= lead.gymName ?? undefined
      person.audiences.add(MailingAudience.Marketing)
    }

    return { wanted, byGym }
  }
}
