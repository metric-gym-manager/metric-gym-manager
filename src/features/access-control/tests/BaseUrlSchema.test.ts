/**
 * The vendor address must be encrypted (remote day, F-08).
 *
 * The account's email and password are sent to this address on every sign-in,
 * so `http://` would put the gym's VFT credentials on the wire in the clear. The
 * only plain-http addresses worth accepting are the local stub the hardware
 * console runs on this machine.
 */

import { accessControlAccountSchema } from '@/features/access-control/schemas/access-control.schemas'

const parse = (baseUrl: string) =>
  accessControlAccountSchema.safeParse({
    baseUrl,
    email: 'gym@example.com',
    password: 'secret',
  })

describe('accessControlAccountSchema — baseUrl (F-08)', () => {
  it('accepts an https address', () => {
    expect(parse('https://acccloudlk.com').success).toBe(true)
  })

  it('rejects a plain http address to a real host, saying why', () => {
    const result = parse('http://acccloudlk.com')

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'The VFT address must start with https://'
    )
  })

  it.each(['http://127.0.0.1:4012', 'http://localhost:4012'])(
    'accepts the local stub %s',
    (url) => {
      expect(parse(url).success).toBe(true)
    }
  )

  it('rejects other schemes', () => {
    expect(parse('ftp://x.com').success).toBe(false)
  })

  it('still rejects something that is not a URL at all', () => {
    const result = parse('acccloudlk.com')

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'Must be a valid URL'
    )
  })

  it('does not accept a look-alike host that merely starts with localhost', () => {
    expect(parse('http://localhost.evil.com').success).toBe(false)
  })
})
