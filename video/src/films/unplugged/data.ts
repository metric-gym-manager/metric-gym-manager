/**
 * Unplugged — 30s at 30fps, Enterprise audiences only. See the Video Ideas
 * Registry, film 6.
 *
 * Product basis (docs/architecture/access-control-master.md): we push each
 * member's paid-through date to the reader as a validity period, and the
 * reader evaluates it on-device from its own clock (A5, confirmed). EndDate
 * is inclusive: paid through the 1st admits until 00:00 on the 2nd.
 * PUBLICATION HOLD: offline admission is test C-1.3 in the VFT simulator plan
 * and has no recorded result yet. Do not publish until it passes.
 */
export const DURATION = 900

export const T = {
  hook: { from: 0, to: 90 },
  cut: { from: 96, to: 130 },
  memberA: { from: 210, to: 420 },
  memberB: { from: 420, to: 630 },
  reveal: { from: 630, to: 780 },
  card: { from: 780, to: 900 },
} as const

/** The reader's own clock. */
export const TODAY = '2026-10-02'
export const READER_CLOCK = '2 Oct · 07:42'

/** On-device rule: admit while today <= paid-through (inclusive). Takes no network input. */
export const admits = (paidThroughIso: string, todayIso: string): boolean => todayIso <= paidThroughIso

export const MEMBERS = [
  { name: 'Nimal Fernando', paidThrough: '2026-10-31', label: '31 Oct', at: T.memberA.from },
  { name: 'Kasun Perera', paidThrough: '2026-10-01', label: '1 Oct', at: T.memberB.from },
] as const

export const SCAN = { press: 40, verdict: 70 } as const
