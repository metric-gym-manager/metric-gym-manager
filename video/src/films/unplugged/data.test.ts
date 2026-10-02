import { describe, expect, it } from 'vitest'
import { admits, MEMBERS, TODAY, T, SCAN } from './data'

describe('Unplugged', () => {
  it('admits the member paid through 31 Oct and refuses the one paid through 1 Oct', () => {
    expect(admits(MEMBERS[0].paidThrough, TODAY)).toBe(true)
    expect(admits(MEMBERS[1].paidThrough, TODAY)).toBe(false)
  })

  it('treats the paid-through date as inclusive (product rule: validTo = next_due_date)', () => {
    expect(admits('2026-10-02', '2026-10-02')).toBe(true)
    expect(admits('2026-10-01', '2026-10-02')).toBe(false)
  })

  it('both scans happen after the cable is cut', () => {
    for (const m of MEMBERS) expect(m.at + SCAN.press).toBeGreaterThan(T.cut.to)
  })

  it('each verdict lands inside its own beat', () => {
    expect(T.memberA.from + SCAN.verdict).toBeLessThan(T.memberA.to)
    expect(T.memberB.from + SCAN.verdict).toBeLessThan(T.memberB.to)
  })
})
