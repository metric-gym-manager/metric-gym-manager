/**
 * Request pacing.
 *
 * The vendor publishes no rate limit, and there is no bulk validity endpoint —
 * so a gym whose members all shift on the same night is one HTTP call each. A
 * large gym's burst can look like an attack from the other side, at exactly the
 * moment members' access is changing.
 */

import { RequestPacer } from '@/lib/access-control/rateLimit'

describe('RequestPacer', () => {
  it('rejects a nonsensical rate', () => {
    expect(() => new RequestPacer(0)).toThrow('greater than zero')
    expect(() => new RequestPacer(-5)).toThrow('greater than zero')
  })

  it('derives the gap from the rate', () => {
    expect(new RequestPacer(5).gapMs).toBe(200)
    expect(new RequestPacer(2).gapMs).toBe(500)
  })

  it('lets the first call through immediately', async () => {
    const pacer = new RequestPacer(2)

    const started = Date.now()
    await pacer.wait()

    expect(Date.now() - started).toBeLessThan(50)
  })

  it('spaces consecutive calls', async () => {
    const pacer = new RequestPacer(10)

    const started = Date.now()
    await pacer.wait()
    await pacer.wait()
    await pacer.wait()

    // Two gaps of 100ms after the free first call.
    expect(Date.now() - started).toBeGreaterThanOrEqual(180)
  })

  it('does not bank credit across an idle period', async () => {
    const pacer = new RequestPacer(20)

    await pacer.wait()
    await new Promise((resolve) => setTimeout(resolve, 120))

    // A long gap must not let a burst straight through afterwards: the next
    // slot anchors to now, not to the stale deadline.
    const started = Date.now()
    await pacer.wait()
    await pacer.wait()

    expect(Date.now() - started).toBeGreaterThanOrEqual(40)
  })

  it('is per-instance, so one worker cannot throttle another', () => {
    const a = new RequestPacer(5)
    const b = new RequestPacer(5)

    expect(a).not.toBe(b)
    expect(a.gapMs).toBe(b.gapMs)
  })
})
