/**
 * @jest-environment node
 */
import {
  createUnsubscribeToken,
  normalizeMailingEmail,
  verifyUnsubscribeToken,
} from '../utils/unsubscribeToken'

const SECRET = 'a'.repeat(64)

describe('unsubscribe tokens', () => {
  it('verifies a token made for the same email', () => {
    const token = createUnsubscribeToken('owner@titanfitness.lk', SECRET)
    expect(verifyUnsubscribeToken('owner@titanfitness.lk', token, SECRET)).toBe(
      true
    )
  })

  it('ignores case and surrounding space in the email', () => {
    const token = createUnsubscribeToken('Owner@TitanFitness.LK', SECRET)
    expect(
      verifyUnsubscribeToken('  owner@titanfitness.lk ', token, SECRET)
    ).toBe(true)
  })

  it('rejects a token made for another email', () => {
    const token = createUnsubscribeToken('someone@else.lk', SECRET)
    expect(verifyUnsubscribeToken('owner@titanfitness.lk', token, SECRET)).toBe(
      false
    )
  })

  it('rejects a token made with another secret', () => {
    const token = createUnsubscribeToken(
      'owner@titanfitness.lk',
      'b'.repeat(64)
    )
    expect(verifyUnsubscribeToken('owner@titanfitness.lk', token, SECRET)).toBe(
      false
    )
  })

  it('rejects a tampered, truncated or empty token', () => {
    const token = createUnsubscribeToken('owner@titanfitness.lk', SECRET)
    const flipped = (token[0] === 'A' ? 'B' : 'A') + token.slice(1)
    for (const bad of [flipped, token.slice(0, -1), '', 'not-a-token']) {
      expect(verifyUnsubscribeToken('owner@titanfitness.lk', bad, SECRET)).toBe(
        false
      )
    }
  })

  it('is URL-safe, so it survives a query string untouched', () => {
    const token = createUnsubscribeToken('owner@titanfitness.lk', SECRET)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('refuses to sign or verify with a short secret', () => {
    expect(() => createUnsubscribeToken('a@b.lk', 'short')).toThrow()
    expect(verifyUnsubscribeToken('a@b.lk', 'x', 'short')).toBe(false)
  })
})

describe('normalizeMailingEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeMailingEmail('  Owner@Gym.LK ')).toBe('owner@gym.lk')
  })

  it('restores a + that a query string decoded as a space', () => {
    // `{{{contact.email}}}` is not URL-encoded, so `a+b@gym.lk` arrives as
    // `a b@gym.lk`. An address cannot contain a space; it was a plus.
    expect(normalizeMailingEmail('owner gym@titan.lk')).toBe(
      'owner+gym@titan.lk'
    )
  })
})
