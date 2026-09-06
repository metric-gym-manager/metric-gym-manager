import { isNewMember, NEW_MEMBER_DAYS } from './isNewMember'

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

/**
 * The clock is frozen for these cases, because the boundary one is otherwise
 * timing-dependent: `daysAgo` reads the clock, `isNewMember` reads it again,
 * and the comparison is `diffDays <= 7`. A gap of a single millisecond between
 * the two reads makes the difference 7.000000011574074 and the assertion
 * fails. In isolation both reads land in the same millisecond and it passes;
 * under a loaded full-suite run it occasionally does not, which is how this
 * file failed once in a 1,464-test run and passed on the next two.
 *
 * Freezing the clock tests the boundary that was intended — exactly seven days
 * — rather than how long the two statements took to execute.
 */
beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-08-31T09:00:00.000Z'))
})
afterAll(() => {
  jest.useRealTimers()
})

describe('isNewMember', () => {
  it('returns true for a member registered today', () => {
    expect(isNewMember(new Date().toISOString())).toBe(true)
  })

  it('returns true for a member registered 1 day ago', () => {
    expect(isNewMember(daysAgo(1))).toBe(true)
  })

  it('returns true for a member registered exactly 7 days ago (boundary)', () => {
    expect(isNewMember(daysAgo(NEW_MEMBER_DAYS))).toBe(true)
  })

  it('returns false for a member registered 8 days ago', () => {
    expect(isNewMember(daysAgo(8))).toBe(false)
  })

  it('returns false for a member registered 30 days ago', () => {
    expect(isNewMember(daysAgo(30))).toBe(false)
  })

  it('returns false for a future date', () => {
    const future = new Date()
    future.setDate(future.getDate() + 1)
    expect(isNewMember(future.toISOString())).toBe(false)
  })
})
