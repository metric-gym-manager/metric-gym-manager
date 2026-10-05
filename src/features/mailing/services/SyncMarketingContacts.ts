import { MailingAudience } from '../config/MailingConfig'
import { normalizeMailingEmail } from '../utils/unsubscribeToken'
import type { AddMarketingContact } from './AddMarketingContact'
import type { AddContactResult } from './IMailingList'
import type { IMarketingSource } from './IMarketingSource'

export interface SyncMarketingContactsOptions {
  /** False (the default in the script) reports what would happen and writes nothing. */
  apply: boolean
  /** Test and E2E gyms, which must never receive marketing. */
  excludeGymIds: string[]
  excludeEmails: string[]
}

export interface SyncReportEntry {
  email: string
  audience: MailingAudience
  outcome: AddContactResult | 'planned' | 'excluded' | 'failed'
  error?: string
}

interface Candidate {
  email: string
  audience: MailingAudience
  name?: string
  gymName?: string | null
  gymId?: string
}

/**
 * Bring the mailing list up to date with the app: every registered gym into
 * Gym owners, every demo lead who consented into Demo leads.
 *
 * Additive only. It adds missing people and never changes an existing
 * contact's subscriptions, so anyone who opted out stays opted out. One
 * failure is recorded and the rest carry on.
 */
export class SyncMarketingContacts {
  constructor(
    private readonly source: IMarketingSource,
    private readonly addContact: AddMarketingContact
  ) {}

  /**
   * @param options - Whether to write, and who to leave out
   * @returns One entry per person and audience, in source order
   */
  async execute(
    options: SyncMarketingContactsOptions
  ): Promise<SyncReportEntry[]> {
    const excludedIds = new Set(options.excludeGymIds)
    const excludedEmails = new Set(
      options.excludeEmails.map(normalizeMailingEmail)
    )

    const owners = await this.source.listGymOwners()
    const leads = await this.source.listConsentingLeads()
    const candidates: Candidate[] = [
      ...owners.map((o) => ({
        email: o.email,
        audience: MailingAudience.GymOwners,
        gymName: o.gymName,
        gymId: o.gymId,
      })),
      ...leads.map((l) => ({
        email: l.email,
        audience: MailingAudience.DemoLeads,
        name: l.name,
        gymName: l.gymName,
      })),
    ]

    const seen = new Set<string>()
    const report: SyncReportEntry[] = []
    for (const candidate of candidates) {
      const email = normalizeMailingEmail(candidate.email)
      const key = `${candidate.audience}:${email}`
      if (seen.has(key)) continue
      seen.add(key)

      const entry = { email, audience: candidate.audience }
      if (
        (candidate.gymId && excludedIds.has(candidate.gymId)) ||
        excludedEmails.has(email)
      ) {
        report.push({ ...entry, outcome: 'excluded' })
        continue
      }
      if (!options.apply) {
        report.push({ ...entry, outcome: 'planned' })
        continue
      }
      try {
        const outcome = await this.addContact.execute({
          email,
          name: candidate.name,
          gymName: candidate.gymName,
          audience: candidate.audience,
        })
        report.push({ ...entry, outcome })
      } catch (error) {
        report.push({
          ...entry,
          outcome: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return report
  }
}
