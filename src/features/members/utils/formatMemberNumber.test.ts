import { formatMemberNumber } from './formatMemberNumber'

describe('formatMemberNumber', () => {
  it('zero-pads to 4 digits with a # prefix', () => {
    expect(formatMemberNumber(1)).toBe('#0001')
    expect(formatMemberNumber(42)).toBe('#0042')
    expect(formatMemberNumber(9999)).toBe('#9999')
  })

  it('shows numbers beyond 9999 in full', () => {
    expect(formatMemberNumber(12345)).toBe('#12345')
  })

  it('returns an em dash for a missing/invalid number', () => {
    expect(formatMemberNumber(null)).toBe('—')
    expect(formatMemberNumber(undefined)).toBe('—')
    expect(formatMemberNumber(NaN)).toBe('—')
  })
})
