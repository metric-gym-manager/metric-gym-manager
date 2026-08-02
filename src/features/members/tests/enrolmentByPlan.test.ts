import { tallyEnrolmentByPlan } from '../services/member-queries.service'

describe('tallyEnrolmentByPlan', () => {
  it('counts occurrences per plan and sorts by count descending', () => {
    const res = tallyEnrolmentByPlan([
      'monthly',
      'monthly',
      'annual',
      'monthly',
      'annual',
      'daily',
    ])
    expect(res).toEqual([
      { planType: 'monthly', activeCount: 3 },
      { planType: 'annual', activeCount: 2 },
      { planType: 'daily', activeCount: 1 },
    ])
  })

  it('returns an empty array when there are no active members', () => {
    expect(tallyEnrolmentByPlan([])).toEqual([])
  })
})
