/** An email to the owner: the brake's alert or the weekly summary. */
export interface OwnerEmail {
  subject: string
  html: string
  text: string
  /** Resend sends one email per key, so a retried alert never doubles. */
  idempotencyKey: string
}

/** Email to the owner's own inbox (`OUTREACH_OWNER_EMAIL`). */
export interface IOwnerMailer {
  /** Send one email to the owner; returns Resend's id. Throws on any failure. */
  send(email: OwnerEmail): Promise<string>
  /**
   * Pass on an email Resend received for the outreach domain (someone wrote
   * to the From address instead of replying), so a reply reaches its writer.
   *
   * @param receivedEmailId - Resend's id of the received email
   * @returns Resend's id of the forwarded copy
   */
  forward(receivedEmailId: string): Promise<string>
}
