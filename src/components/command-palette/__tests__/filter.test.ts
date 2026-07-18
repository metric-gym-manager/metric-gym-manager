import { matchesQuery } from '../filter'

describe('matchesQuery', () => {
  it('matches everything when the query is empty or whitespace', () => {
    expect(matchesQuery('', 'Dashboard')).toBe(true)
    expect(matchesQuery('   ', 'Dashboard')).toBe(true)
  })

  it('matches on a case-insensitive substring of the label', () => {
    expect(matchesQuery('dash', 'Dashboard')).toBe(true)
    expect(matchesQuery('BOARD', 'Dashboard')).toBe(true)
    expect(matchesQuery('fee', 'Fee Collection')).toBe(true)
  })

  it('matches on a keyword even when the label does not contain the query', () => {
    expect(matchesQuery('income', 'Revenue', ['income', 'earnings'])).toBe(true)
    expect(matchesQuery('sms', 'Announcements', ['broadcast', 'sms'])).toBe(
      true
    )
  })

  it('returns false when neither the label nor any keyword matches', () => {
    expect(matchesQuery('xyz', 'Dashboard', ['home', 'overview'])).toBe(false)
    expect(matchesQuery('billing', 'Members', ['clients'])).toBe(false)
  })

  it('trims surrounding whitespace from the query before matching', () => {
    expect(matchesQuery('  member  ', 'Members')).toBe(true)
  })

  it('treats a missing keywords argument as no keywords', () => {
    expect(matchesQuery('help', 'Support')).toBe(false)
  })
})
