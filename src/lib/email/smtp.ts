import nodemailer from 'nodemailer'

/**
 * The app's SMTP sender: the Google Workspace account admin@capitalistone.co,
 * the same account Supabase Auth sends its emails through. Mail goes out as
 * the verified "Send mail as" alias noreply@metricgymos.com, so SPF, DKIM and
 * DMARC pass as they do for the auth emails (supabase/config.toml records
 * that setup).
 *
 * Credentials come from the environment: `SMTP_USER` (the account; an alias
 * such as hello@ cannot log in and Gmail answers 535) and `SMTP_PASS` (a
 * Google app password). Either missing means no mailer: callers send nothing
 * and record why, so the app runs without them.
 */

export const SMTP_HOST = 'smtp.gmail.com'
export const SMTP_PORT = 465

export interface MailMessage {
  from: string
  to: string
  replyTo?: string
  subject: string
  text: string
}

export interface Mailer {
  /** Send one message; rejects with the SMTP error when it is not accepted. */
  send(message: MailMessage): Promise<void>
}

/**
 * Build the SMTP mailer from the environment.
 *
 * @param env - Variables to read (defaults to `process.env`)
 * @returns A mailer, or `null` when `SMTP_USER` or `SMTP_PASS` is unset
 *
 * @example
 * const mailer = createSmtpMailer()
 * if (mailer) await mailer.send({ from, to, subject, text })
 */
export function createSmtpMailer(
  env: Record<string, string | undefined> = process.env
): Mailer | null {
  const user = env.SMTP_USER?.trim()
  // Google displays app passwords in four groups of four.
  const pass = env.SMTP_PASS?.replace(/\s+/g, '')
  if (!user || !pass) return null

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user, pass },
    // A serverless request waits on this; never let a stuck server hold it.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  return {
    async send(message) {
      await transport.sendMail(message)
    },
  }
}
