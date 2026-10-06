/** The unsubscribe link's token does not match its email. */
export class InvalidUnsubscribeLinkError extends Error {
  constructor() {
    super('Unsubscribe link is invalid')
    this.name = 'InvalidUnsubscribeLinkError'
  }
}

/** `RESEND_API_KEY` or `MARKETING_UNSUBSCRIBE_SECRET` is not configured. */
export class MailingUnavailableError extends Error {
  constructor() {
    super('Mailing is not configured')
    this.name = 'MailingUnavailableError'
  }
}
