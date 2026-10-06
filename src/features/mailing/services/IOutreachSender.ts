/** One introduction email, ready to send. */
export interface OutreachEmail {
  to: string
  subject: string
  html: string
  text: string
  /** Also sent as the List-Unsubscribe header. */
  unsubscribeUrl: string
  topicId: string
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
