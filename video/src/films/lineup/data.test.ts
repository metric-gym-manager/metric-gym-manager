import { describe, expect, it } from 'vitest'
import { PEOPLE, CULPRIT, SEARCH, RESULT_AT, T } from './data'

describe('The Lineup', () => {
  it('has exactly one member who has not paid, and it is number 4', () => {
    expect(PEOPLE.filter((p) => p.status === 'Expired')).toHaveLength(1)
    expect(CULPRIT.n).toBe(4)
  })

  it('the unpaid member carries the most "committed" props, so looks cannot give it away', () => {
    const most = Math.max(...PEOPLE.map((p) => p.props.length))
    expect(CULPRIT.props.length).toBe(most)
  })

  it('the search term finds only the culprit', () => {
    expect(PEOPLE.filter((p) => p.name.startsWith(SEARCH.text)).map((p) => p.n)).toEqual([4])
  })

  it('the result lands before the badges reveal', () => {
    expect(RESULT_AT).toBeLessThan(T.badges.from)
  })
})
