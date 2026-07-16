/**
 * In-memory rate limiter tests
 */

import { checkRateLimit, resetRateLimits } from '../rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows hits up to the limit and rejects beyond it', () => {
    expect(checkRateLimit('key', 3, 60_000)).toBe(true);
    expect(checkRateLimit('key', 3, 60_000)).toBe(true);
    expect(checkRateLimit('key', 3, 60_000)).toBe(true);
    expect(checkRateLimit('key', 3, 60_000)).toBe(false);
  });

  it('tracks keys independently', () => {
    expect(checkRateLimit('a', 1, 60_000)).toBe(true);
    expect(checkRateLimit('a', 1, 60_000)).toBe(false);
    expect(checkRateLimit('b', 1, 60_000)).toBe(true);
  });

  it('resets after the window elapses', () => {
    jest.useFakeTimers();
    try {
      expect(checkRateLimit('key', 1, 1_000)).toBe(true);
      expect(checkRateLimit('key', 1, 1_000)).toBe(false);

      jest.advanceTimersByTime(1_001);

      expect(checkRateLimit('key', 1, 1_000)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
