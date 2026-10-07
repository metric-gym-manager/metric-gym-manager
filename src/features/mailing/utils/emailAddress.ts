import { normalizeMailingEmail } from './unsubscribeToken'

const ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

/**
 * The address in a header value such as `Ruwan Perera <Ruwan@IronGym.lk>`
 * or a bare `owner@gym.lk`, normalised (lowercase) the way contacts and the
 * outreach ledger store it.
 *
 * @param value - A From or To header value
 * @returns The address, or null when there is none
 */
export function emailAddressOf(value: string): string | null {
  const bracketed = value.match(/<([^<>]*)>\s*$/)
  const candidate = (bracketed ? bracketed[1] : value).trim()
  return ADDRESS.test(candidate) ? normalizeMailingEmail(candidate) : null
}

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/**
 * The inbox an address reaches, for telling whether two spellings are the
 * same person: lowercase, without a `+tag` (sub-addressing, which Gmail,
 * Outlook, iCloud and most hosts deliver to the base inbox), and for Gmail
 * without dots and with `googlemail.com` read as `gmail.com`. Used only to
 * keep customers out of outreach — never to address an email.
 *
 * @example
 * mailboxKey('Colombo.Shyan+promo@googlemail.com') // 'colomboshyan@gmail.com'
 */
export function mailboxKey(email: string): string {
  const address = normalizeMailingEmail(email)
  const at = address.lastIndexOf('@')
  if (at < 0) return address
  let local = address.slice(0, at).split('+')[0]
  let domain = address.slice(at + 1)
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '')
    domain = 'gmail.com'
  }
  return `${local}@${domain}`
}
