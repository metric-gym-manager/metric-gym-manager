import { describe, expect, it } from 'vitest'
import { MEMBERS, statusAt, uncollectedAt, countsAt, TABLE_ORDER } from './data'
import { STALL_FRAMES, T, DURATION } from './timeline'

describe('film data invariants', () => {
  it('has exactly 100 members on a 10×10 grid with unique cells', () => {
    expect(MEMBERS).toHaveLength(100)
    expect(new Set(MEMBERS.map((m) => `${m.row},${m.col}`)).size).toBe(100)
  })

  it('every square is visible by the end of the hook', () => {
    expect(Math.max(...MEMBERS.map((m) => m.appearAt))).toBeLessThan(T.hook.to)
  })

  it('returners come back before they would count as stalled (the rule is honest)', () => {
    for (const m of MEMBERS.filter((x) => x.returnAt !== null)) {
      expect(m.returnAt! - m.amberAt!).toBeLessThan(STALL_FRAMES)
      expect(m.stallAt).toBeNull()
    }
  })

  it('the counter changes only on a stall or a recovery frame, by exactly one fee', () => {
    const events = new Map<number, number>()
    for (const m of MEMBERS) {
      if (m.stallAt !== null) events.set(m.stallAt, (events.get(m.stallAt) ?? 0) + m.fee)
      if (m.recoverAt !== null) events.set(m.recoverAt, (events.get(m.recoverAt) ?? 0) - m.fee)
    }
    for (let f = 1; f < DURATION; f++) {
      expect(uncollectedAt(f) - uncollectedAt(f - 1)).toBe(events.get(f) ?? 0)
    }
  })

  it('the counter never moves during the freeze or reveal', () => {
    const held = uncollectedAt(T.freeze.from)
    for (let f = T.freeze.from; f < T.resolve.from; f++) expect(uncollectedAt(f)).toBe(held)
  })

  it('reminders reduce the counter but do not reach zero (no overclaim)', () => {
    const peak = uncollectedAt(T.freeze.from)
    const after = uncollectedAt(T.resolve.to)
    expect(peak).toBeGreaterThan(0)
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(peak)
  })

  it('no status changes happen during the freeze or reveal', () => {
    for (const m of MEMBERS) {
      const s = statusAt(m, T.freeze.from)
      for (let f = T.freeze.from; f < T.resolve.from; f++) expect(statusAt(m, f)).toBe(s)
    }
  })

  it('only the three product statuses appear once the grid is filled', () => {
    for (let f = T.hook.to; f < DURATION; f++) {
      const c = countsAt(f)
      expect(c.paid + c.due + c.expired).toBe(100)
    }
  })

  it('the table puts unresolved members first', () => {
    const top = TABLE_ORDER.slice(0, 4).map((m) => statusAt(m, T.resolve.to))
    expect(top.every((s) => s === 'expired' || s === 'due')).toBe(true)
    expect(statusAt(TABLE_ORDER[4], T.resolve.to)).toBe('paid')
  })
})
