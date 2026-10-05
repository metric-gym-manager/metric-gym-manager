import type { MailingAudience } from '../config/MailingConfig'
import {
  createUnsubscribeToken,
  normalizeMailingEmail,
} from '../utils/unsubscribeToken'
import { MailingUnavailableError } from './errors'
import type { AddContactResult, IMailingList } from './IMailingList'

/** A person to add to a mailing audience, as the caller knows them. */
export interface AddMarketingContactInput {
  email: string
  /** Full name; the first word becomes the contact's first name. */
  name?: string | null
  gymName?: string | null
  audience: MailingAudience
}

/**
 * Add a person to a mailing audience, signed for their unsubscribe links.
 *
 * Used for demo leads who ticked the consent box and for registered gym
 * owners. An existing contact keeps its subscriptions (see `IMailingList`).
 */
export class AddMarketingContact {
  constructor(
    /** `null` when `RESEND_API_KEY` is unset. */
    private readonly list: IMailingList | null,
    /** `null` when `MARKETING_UNSUBSCRIBE_SECRET` is unset. */
    private readonly secret: string | null
  ) {}

  /**
   * @param input - Who to add, and to which audience
   * @returns What the provider did
   * @throws {MailingUnavailableError} When mailing is not configured
   */
  async execute(input: AddMarketingContactInput): Promise<AddContactResult> {
    if (!this.list || !this.secret) throw new MailingUnavailableError()

    const email = normalizeMailingEmail(input.email)
    const firstName = input.name?.trim().split(/\s+/)[0] || undefined
    const gymName = input.gymName?.trim() || undefined

    return this.list.addContact({
      email,
      firstName,
      gymName,
      audience: input.audience,
      unsubscribeToken: createUnsubscribeToken(email, this.secret),
    })
  }
}
