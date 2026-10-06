/**
 * Top-level domains reserved by RFC 2606 / RFC 6761, plus mDNS `.local`: an
 * address there can never receive mail. A send to one hard-bounces, and
 * bounces cost the sending domain reputation, so they are never imported or
 * sent to.
 */
const UNDELIVERABLE_TLDS = ['test', 'example', 'invalid', 'localhost', 'local']

/**
 * True when the address can never receive mail.
 *
 * @param email - Any address
 */
export function isUndeliverable(email: string): boolean {
  const domain = email.split('@')[1] ?? ''
  const tld = domain.split('.').pop() ?? ''
  return UNDELIVERABLE_TLDS.includes(tld.toLowerCase())
}
