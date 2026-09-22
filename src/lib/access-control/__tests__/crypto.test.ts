/**
 * @jest-environment node
 */

/**
 * Vendor credential encryption.
 *
 * The case that matters here is not the happy path — it is what a credential
 * written under a **different key** looks like when we try to read it. On this
 * deployment that state was live for 25 days: 660 `reconcile_member` jobs were
 * attempted six times each and dead-lettered carrying the raw Node message
 * "Unsupported state or unable to authenticate data", which names neither the
 * cause nor the remedy. Re-encrypting is the only fix, and no number of
 * retries can reach it.
 */

import {
  CredentialDecryptionError,
  decryptSecret,
  encryptSecret,
} from '@/lib/access-control/crypto'

/** Two independent 32-byte keys, base64 as the env var takes them. */
const KEY_A = Buffer.alloc(32, 1).toString('base64')
const KEY_B = Buffer.alloc(32, 2).toString('base64')

describe('credential encryption', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, ACCESS_CONTROL_ENCRYPTION_KEY: KEY_A }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('round-trips a secret', () => {
    expect(decryptSecret(encryptSecret('hunter2'))).toBe('hunter2')
  })

  it('fails as a named error when the key has changed', () => {
    const stored = encryptSecret('hunter2')
    process.env.ACCESS_CONTROL_ENCRYPTION_KEY = KEY_B

    expect(() => decryptSecret(stored)).toThrow(CredentialDecryptionError)
  })

  it('says what went wrong and what to do about it', () => {
    const stored = encryptSecret('hunter2')
    process.env.ACCESS_CONTROL_ENCRYPTION_KEY = KEY_B

    // The operator-facing string. It reaches a dead job's `last_error` and the
    // system-health screen, so "Unsupported state" is not good enough.
    expect(() => decryptSecret(stored)).toThrow(/re-enter/i)
    expect(() => decryptSecret(stored)).toThrow(/ACCESS_CONTROL_ENCRYPTION_KEY/)
  })

  it('reports a truncated or corrupt ciphertext the same way', () => {
    expect(() => decryptSecret('c2hvcnQ=')).toThrow(CredentialDecryptionError)
  })

  it('treats a missing key as the same class of problem', () => {
    const stored = encryptSecret('hunter2')
    delete process.env.ACCESS_CONTROL_ENCRYPTION_KEY

    // Unreadable is unreadable: the job must not retry either way.
    expect(() => decryptSecret(stored)).toThrow(CredentialDecryptionError)
  })

  /**
   * Inverted (2026-09-23): the fix assumed every decryption failure is
   * permanent. Two of the three are — a wrong key and a corrupt ciphertext
   * stay wrong until someone re-enters the credentials. But an **absent** key
   * is different: an env var can be missing for a moment during a deploy or on
   * a cold start that raced its configuration. Dead-lettering on the first
   * attempt turns a blip into every member of that gym silently not syncing
   * until a person notices.
   */
  it('marks an absent key as worth retrying', () => {
    const stored = encryptSecret('hunter2')
    delete process.env.ACCESS_CONTROL_ENCRYPTION_KEY

    try {
      decryptSecret(stored)
      throw new Error('expected a throw')
    } catch (error) {
      expect(error).toBeInstanceOf(CredentialDecryptionError)
      expect((error as CredentialDecryptionError).retryable).toBe(true)
    }
  })

  it('marks a wrong key as permanent', () => {
    const stored = encryptSecret('hunter2')
    process.env.ACCESS_CONTROL_ENCRYPTION_KEY = KEY_B

    try {
      decryptSecret(stored)
      throw new Error('expected a throw')
    } catch (error) {
      // The ciphertext was written under another key. No amount of asking
      // again changes that.
      expect((error as CredentialDecryptionError).retryable).toBe(false)
    }
  })

  it('marks a corrupt ciphertext as permanent', () => {
    try {
      decryptSecret('c2hvcnQ=')
      throw new Error('expected a throw')
    } catch (error) {
      expect((error as CredentialDecryptionError).retryable).toBe(false)
    }
  })

  it('does not put the plaintext or the key in the message', () => {
    const stored = encryptSecret('hunter2')
    process.env.ACCESS_CONTROL_ENCRYPTION_KEY = KEY_B

    try {
      decryptSecret(stored)
      throw new Error('expected a throw')
    } catch (error) {
      const message = (error as Error).message
      expect(message).not.toContain('hunter2')
      expect(message).not.toContain(KEY_B)
    }
  })
})
