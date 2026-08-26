/**
 * Request pacing for the vendor API.
 *
 * Stateful, so it lives in `lib/` rather than `utils/` — R8 is explicit that
 * stateful helpers belong here and `utils/` stays pure.
 *
 * The vendor publishes no rate limit. There is also no bulk validity endpoint,
 * so a gym whose members all shift on the same night is one call each: a large
 * gym can produce a burst that looks like an attack from the other side. Pacing
 * costs us nothing (these run in background jobs, not in front of a user) and
 * removes the chance of being throttled or blocked at exactly the moment
 * members' access is changing.
 */

/**
 * Spaces calls to at most `maxPerSecond`.
 *
 * Deliberately per-instance rather than global: each serverless invocation gets
 * its own, which is the correct scope for a drain run and needs no shared
 * state. It smooths a single worker's burst; it is not a distributed limiter.
 */
export class RequestPacer {
  private readonly minGapMs: number
  private nextAllowedAt = 0

  constructor(maxPerSecond: number) {
    if (maxPerSecond <= 0) {
      throw new Error('maxPerSecond must be greater than zero')
    }

    this.minGapMs = 1000 / maxPerSecond
  }

  /**
   * Wait until the next call is due.
   *
   * Returns immediately when enough time has already passed, so an idle worker
   * pays nothing.
   */
  async wait(): Promise<void> {
    const now = Date.now()
    const waitMs = this.nextAllowedAt - now

    // Anchor the next slot to now when we are already past due, rather than to
    // the stale deadline — otherwise a long gap would bank credit and let a
    // burst through immediately afterwards.
    this.nextAllowedAt = Math.max(now, this.nextAllowedAt) + this.minGapMs

    if (waitMs > 0) {
      await sleep(waitMs)
    }
  }

  /** Milliseconds between permitted calls. Exposed for tests. */
  get gapMs(): number {
    return this.minGapMs
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
