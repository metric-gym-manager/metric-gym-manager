/** One email of the series, ready to send. */
export interface OutreachEmail {
  to: string
  subject: string
  html: string
  text: string
  /** The recipient's /unsubscribe page, linked in the footer. */
  unsubscribeUrl: string
  /** The one-click endpoint (RFC 8058) for the List-Unsubscribe header. */
  oneClickUrl: string
  topicId: string
  /** Shown and filterable in Resend's email log. */
  tags: { name: string; value: string }[]
  /** Resend sends one email per key, so a retried request never doubles. */
  idempotencyKey: string
}

/** The slice of Resend outreach uses. */
export interface IOutreachSender {
  /**
   * Make sure the address is a Resend contact carrying its unsubscribe
   * token, so /unsubscribe can record an opt-out. Never in a segment, and an
   * existing contact's token is never overwritten.
   */
  ensureContact(
    email: string,
    unsubscribeToken: string,
    gymName: string | null
  ): Promise<void>
  /** False once the address opted out of Marketing or unsubscribed from everything. */
  canReceiveMarketing(email: string): Promise<boolean>
  /** Send one email; returns Resend's id. Throws on any failure. */
  send(email: OutreachEmail): Promise<string>
}
