import { tierFromHeaders } from '../tierFromHeaders'

/**
 * The server's tier hint (mobile rebuild plan §4, risk r02).
 *
 * Being wrong costs a re-render, never a wrong screen — the client measures
 * the real width on its first commit. What being wrong DOES cost is the thing
 * this exists to avoid: a phone painting the desktop composition and flipping.
 */
describe('tierFromHeaders', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const IPAD =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  const IPAD_LEGACY =
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const ANDROID_PHONE =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
  const ANDROID_TABLET =
    'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
  const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

  describe('the client hint, where the browser sends one', () => {
    it('trusts ?1 as a phone', () => {
      expect(tierFromHeaders('?1', MAC)).toBe('phone')
    })

    it('trusts ?0 as a desktop, without sniffing the UA behind it', () => {
      // `?0` is an ANSWER, not an absence. Falling through to the UA here
      // would let a desktop Chrome with a spoofed UA beat the browser's own
      // statement about itself.
      expect(tierFromHeaders('?0', IPHONE)).toBe('desktop')
    })
  })

  describe('the user agent, where it does not', () => {
    // Label and expectation first: Jest fills `%s` from the tuple in order, so
    // a UA in the middle prints the whole string into the test name.
    it.each([
      ['an iPhone', 'phone', IPHONE],
      ['an Android phone', 'phone', ANDROID_PHONE],
      ['a Mac', 'desktop', MAC],
    ])('reads %s as %s', (_label, expected, ua) => {
      expect(tierFromHeaders(null, ua)).toBe(expected)
    })

    it('reads an iPad as a desktop — ruling M5, decision d02', () => {
      // iPadOS Safari reports a Mac UA and sends no client hints, and the plan
      // gives 768–1023 the desktop composition anyway. A tablet that rendered
      // the phone chrome and flipped would be a worse first paint than one
      // that starts where it ends.
      expect(tierFromHeaders(null, IPAD)).toBe('desktop')
      expect(tierFromHeaders(null, IPAD_LEGACY)).toBe('desktop')
    })

    it('reads an Android tablet as a desktop', () => {
      // Google's own convention: Android WITHOUT "Mobile" is a tablet. The
      // phone pattern matches "Android", so the tablet check has to come
      // first or every tablet reads as a phone.
      expect(tierFromHeaders(null, ANDROID_TABLET)).toBe('desktop')
    })
  })

  describe('when there is nothing to read', () => {
    it.each([
      [null, null],
      [undefined, undefined],
      [null, ''],
    ])('answers desktop for (%p, %p)', (hint, ua) => {
      expect(tierFromHeaders(hint, ua)).toBe('desktop')
    })

    it('ignores a hint value it does not recognise', () => {
      // A malformed hint must not be read as either answer; the UA decides.
      expect(tierFromHeaders('1', IPHONE)).toBe('phone')
      expect(tierFromHeaders('true', MAC)).toBe('desktop')
    })
  })
})
