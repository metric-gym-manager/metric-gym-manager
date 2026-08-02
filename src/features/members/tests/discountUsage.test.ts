import { tallyDiscountUsage } from '../services/member-queries.service'

describe('tallyDiscountUsage', () => {
  it('counts members per discount, ignoring nulls, sorted by usage descending', () => {
    expect(tallyDiscountUsage(['d1', 'd2', 'd1', null, 'd1', 'd2'])).toEqual([
      { discountId: 'd1', memberCount: 3 },
      { discountId: 'd2', memberCount: 2 },
    ])
  })

  it('returns an empty array when no members carry a discount', () => {
    expect(tallyDiscountUsage([null, null])).toEqual([])
  })
})
