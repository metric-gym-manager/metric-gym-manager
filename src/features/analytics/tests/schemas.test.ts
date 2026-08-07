import { memberAnalyticsQuerySchema } from '../schemas/analytics.schemas'

describe('memberAnalyticsQuerySchema', () => {
  it('accepts a valid query (metric optional)', () => {
    expect(
      memberAnalyticsQuerySchema.parse({ range: '1M', year: 2026 })
    ).toEqual({ range: '1M', year: 2026 })
    expect(
      memberAnalyticsQuerySchema.parse({
        range: 'YTD',
        year: 2024,
        metric: 'churnRate',
      })
    ).toEqual({ range: 'YTD', year: 2024, metric: 'churnRate' })
  })

  it('rejects an unknown range', () => {
    expect(() =>
      memberAnalyticsQuerySchema.parse({ range: '5Y', year: 2026 })
    ).toThrow()
  })

  it('rejects an unknown metric', () => {
    expect(() =>
      memberAnalyticsQuerySchema.parse({
        range: '1M',
        year: 2026,
        metric: 'mrr',
      })
    ).toThrow()
  })

  it('rejects an out-of-range year', () => {
    expect(() =>
      memberAnalyticsQuerySchema.parse({ range: '1M', year: 1999 })
    ).toThrow()
    expect(() =>
      memberAnalyticsQuerySchema.parse({ range: '1M', year: 2101 })
    ).toThrow()
  })
})
