import { isNewMember, NEW_MEMBER_DAYS } from './isNewMember'

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

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
