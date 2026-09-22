/**
 * Credential encryption for stored vendor secrets.
 *
 * AES-256-GCM, which is authenticated — a tampered ciphertext fails to decrypt
 * rather than yielding garbage that we then send to a door controller.
 *
 * These credentials are unusually sensitive: the vendor API grants
 * administrative reach across every area on an account, so a leaked credential
 * is not scoped to one gym. They are stored in a table with RLS enabled and no
 * policies (service-role only) and encrypted at rest on top of that.
 *
 * Mirrors the `lib/payhere/crypto.ts` precedent.
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit nonce, the GCM standard
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Resolve the encryption key from the environment.
 *
 * @returns 32-byte key.
 * @throws {Error} If the key is missing or the wrong length — failing loudly at
 *   the first use beats silently storing recoverable secrets.
 */
function getKey(): Buffer {
  const raw = process.env.ACCESS_CONTROL_ENCRYPTION_KEY

  if (!raw) {
    throw new Error(
      'ACCESS_CONTROL_ENCRYPTION_KEY is not configured — refusing to handle vendor credentials'
    )
  }

  const key = Buffer.from(raw, 'base64')

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ACCESS_CONTROL_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}`
    )
  }

  return key
}

/**
 * Encrypt a secret for storage.
 *
 * @param plaintext - The value to protect.
 * @returns Base64 of `iv || authTag || ciphertext`, safe for a TEXT column.
 *
 * @example
 * const stored = encryptSecret('hunter2')
 * decryptSecret(stored) // => 'hunter2'
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

/**
 * A stored credential could not be read back.
 *
 * Its own type because of what it means operationally: **no retry can fix
 * it.** The ciphertext is intact or it is not, and the key is right or it is
 * not; both are configuration, and both stay wrong until a person acts. The
 * outbox uses this to dead-letter such a job immediately and flag it for
 * attention rather than spending six attempts discovering the same thing six
 * times.
 *
 * It carries no plaintext, no key material and no ciphertext — the message is
 * written to be read by an operator on a screen, and it ends up in
 * `access_sync_jobs.last_error`.
 */
export class CredentialDecryptionError extends Error {
  /**
   * Whether asking again could ever succeed.
   *
   * A wrong key or a corrupt ciphertext cannot be retried into working: the
   * bytes were written under another key and stay that way until someone
   * re-enters the credentials. An **absent** key is a different thing — an
   * environment variable can be missing for a moment during a deploy, or on a
   * cold start that raced its own configuration. Dead-lettering that on the
   * first attempt turns a blip into every member of a gym silently not
   * syncing until a person notices, which is the failure retries exist for.
   */
  readonly retryable: boolean

  constructor(cause: string, options: { retryable?: boolean } = {}) {
    super(
      `Stored vendor credentials cannot be decrypted (${cause}). ` +
        'This is what a changed ACCESS_CONTROL_ENCRYPTION_KEY looks like from the outside: ' +
        'the ciphertext was written under a different key and no retry can recover it. ' +
        'Re-enter the account credentials to store them under the current key.'
    )
    this.name = 'CredentialDecryptionError'
    this.retryable = options.retryable ?? false
  }
}

/**
 * Decrypt a stored secret.
 *
 * @param payload - Value produced by {@link encryptSecret}.
 * @returns The original plaintext.
 * @throws {CredentialDecryptionError} If the key is unusable, or the payload
 *   is malformed or fails authentication. One error type for all three,
 *   because the remedy is the same and the distinction only helps an attacker.
 */
export function decryptSecret(payload: string): string {
  let key: Buffer

  try {
    key = getKey()
  } catch (error) {
    // Configuration that may not have arrived yet, rather than configuration
    // that is wrong. Worth one more pass before giving up on it.
    throw new CredentialDecryptionError(
      error instanceof Error ? error.message : 'encryption key unusable',
      { retryable: true }
    )
  }

  const buffer = Buffer.from(payload, 'base64')

  if (buffer.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new CredentialDecryptionError('ciphertext too short to be valid')
  }

  const iv = buffer.subarray(0, IV_LENGTH)
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    // Deliberately not forwarding the Node message. "Unsupported state or
    // unable to authenticate data" is what sat in 660 dead jobs for 25 days
    // naming neither cause nor remedy.
    throw new CredentialDecryptionError('authentication failed')
  }
}

/**
 * Generate a webhook path token.
 *
 * The vendor protocol carries no signature, so an unguessable URL is the
 * primary authentication. 32 bytes gives 256 bits of entropy.
 *
 * @returns URL-safe hex token.
 */
export function generateWebhookToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Constant-time comparison for tokens and secrets.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns True if identical.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) {
    return false
  }

  return crypto.timingSafeEqual(bufA, bufB)
}
