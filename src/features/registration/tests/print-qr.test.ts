import { posterFilename } from '../utils/print-qr'

describe('posterFilename', () => {
  it('slugifies a normal gym name', () => {
    expect(posterFilename('Royal Fitness World')).toBe(
      'royal-fitness-world-registration-poster.png'
    )
  })

  it('collapses punctuation and symbols into single hyphens', () => {
    expect(posterFilename('Iron & Oak Strength Co.')).toBe(
      'iron-oak-strength-co-registration-poster.png'
    )
  })

  it('trims leading and trailing separators', () => {
    expect(posterFilename('  --Gym!!  ')).toBe('gym-registration-poster.png')
  })

  it('falls back to "gym" when nothing usable remains', () => {
    expect(posterFilename('!!!')).toBe('gym-registration-poster.png')
    expect(posterFilename('')).toBe('gym-registration-poster.png')
  })
})
