import type { MailingTopic } from '../config/MailingConfig'
import {
  deliveredMailingEmail,
  normalizeMailingEmail,
  verifyUnsubscribeToken,
} from '../utils/unsubscribeToken'
import { InvalidUnsubscribeLinkError, MailingUnavailableError } from './errors'
import type { IMailingList } from './IMailingList'

/** A request from the /unsubscribe page. */
export interface UpdateEmailPreferencesInput {
  email: string
  token: string
  /** The kinds to stop; the others are left as they are. */
  topics: MailingTopic[]
}

/**
 * Opt a person out of the kinds of email they ticked on /unsubscribe.
 *
 * The link's token proves the visitor holds the address, so nobody can change
 * another person's preferences by typing their email. Only the chosen topics
 * change: opting out of marketing leaves product and security updates on, and
 * the reverse.
 */
export class UpdateEmailPreferences {
  constructor(
    /** `null` when `RESEND_API_KEY` is unset. */
    private readonly list: IMailingList | null,
    /** `null` when `MARKETING_UNSUBSCRIBE_SECRET` is unset. */
    private readonly secret: string | null
  ) {}

  /**
   * Check the link and record the opt-outs.
   *
   * @param input - The address, token and topics from the page
   * @throws {MailingUnavailableError} When mailing is not configured
   * @throws {InvalidUnsubscribeLinkError} When the token does not match
   */
  async execute(input: UpdateEmailPreferencesInput): Promise<void> {
    if (!this.list || !this.secret) throw new MailingUnavailableError()

    // The token is signed over the lowercased address, so case never breaks
    // a link; the write uses the address as delivered, because Resend
    // matches contacts case-sensitively and the link carries the stored form.
    const signed = normalizeMailingEmail(input.email)
    if (!verifyUnsubscribeToken(signed, input.token, this.secret)) {
      throw new InvalidUnsubscribeLinkError()
    }

    await this.list.optOut(deliveredMailingEmail(input.email), input.topics)
  }
}
