/**
 * The single data source for the film. The grid, the money counter, the
 * members table and the KPI tiles are all derived from MEMBERS, so the counter
 * can never move without a square causing it (and vice versa).
 *
 * Status vocabulary matches the product: paid (active, current), due, expired.
 */
import { STALL_FRAMES, T, REMINDER_AT } from './timeline'

export type Status = 'hidden' | 'paid' | 'due' | 'expired'

export interface Member {
  id: number
  row: number
  col: number
  name: string
  plan: string
  /** Monthly fee in LKR. Every counter step equals exactly one of these. */
  fee: number
  appearAt: number
  /** Frame the square turns amber (payment falls due). */
  amberAt: number | null
  /** Frame it returns to green unprompted (paid on time). Always < amberAt + STALL_FRAMES. */
  returnAt: number | null
  /** Frame the unpaid due is counted as uncollected (amberAt + STALL_FRAMES). */
  stallAt: number | null
  /** Frame the membership expires. */
  redAt: number | null
  /** Frame the member pays after a reminder. */
  recoverAt: number | null
}

const COLS = 10
const PLANS = [
  { plan: 'Monthly', fee: 6500 },
  { plan: 'Monthly', fee: 6500 },
  { plan: 'Monthly', fee: 6500 },
  { plan: 'Student', fee: 5500 },
  { plan: 'Monthly + PT', fee: 8500 },
] as const
const FEE_TO_PLAN: Record<number, string> = { 5500: 'Student', 6500: 'Monthly', 8500: 'Monthly + PT' }

const FIRST = [
  'Nimal', 'Kasun', 'Ayesha', 'Dilani', 'Tharindu', 'Sachini', 'Ruwan', 'Fathima', 'Chamara', 'Ishara',
  'Nuwan', 'Hiruni', 'Dinesh', 'Madhavi', 'Shehan', 'Nadeesha', 'Kavindu', 'Rashmi', 'Imran', 'Anjali',
  'Pradeep', 'Sanduni', 'Lahiru', 'Tharushi', 'Asanka', 'Minoli', 'Janith', 'Senuri', 'Rizwan', 'Gayani',
]
const INITIALS = 'ABDFGHJKLMNPRSTW'

/** mulberry32 — tiny deterministic PRNG so every render is identical. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── The schedule (frames). Authored, not random: this IS the edit. ──────────
/** Act 1 — ambers that return on their own. Teaches the rule. */
const RULE_RETURNERS = [70, 92, 110, 134, 150, 172, 190, 212]
/** Act 2 — the rule still holds for some, which makes the stalls stand out. */
const LATE_RETURNERS = [255, 292, 344, 395]
const RETURN_AFTER = 26
/** Act 2 — ambers that never return. Fee per staller, in stall order. */
const STALLERS = [248, 262, 281, 300, 318, 335, 352, 370, 386, 402, 418]
const STALLER_FEES = [6500, 8500, 6500, 5500, 6500, 6500, 8500, 5500, 6500, 6500, 6500]
/** Act 3 — which stallers (by stall order) expire, and when. */
const EXPIRE = [
  { staller: 0, at: 462 },
  { staller: 1, at: 480 },
  { staller: 3, at: 497 },
  { staller: 4, at: 515 },
  { staller: 6, at: 532 },
  { staller: 7, at: 551 },
  { staller: 9, at: 570 },
]
/**
 * Resolve — stallers (by stall order) who pay after the reminder. Deliberately
 * NOT all of them: reminders do not guarantee payment, so the counter must not
 * reach zero. 7 of 11 recover.
 */
const RECOVER = [2, 5, 8, 10, 0, 4, 7]
const RECOVER_START = REMINDER_AT + 14
const RECOVER_STEP = 5

function build(): Member[] {
  const rand = prng(20260928)
  const ids = Array.from({ length: 100 }, (_, i) => i)
  // Fisher–Yates so event squares are scattered across the grid.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }

  const members: Member[] = Array.from({ length: 100 }, (_, id) => {
    const row = Math.floor(id / COLS)
    const col = id % COLS
    const p = PLANS[Math.floor(rand() * PLANS.length)]
    return {
      id,
      row,
      col,
      name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${INITIALS[Math.floor(rand() * INITIALS.length)]}.`,
      plan: p.plan,
      fee: p.fee,
      // Diagonal fill wave across the hook.
      appearAt: (row + col) * 2,
      amberAt: null,
      returnAt: null,
      stallAt: null,
      redAt: null,
      recoverAt: null,
    }
  })

  let cursor = 0
  for (const at of [...RULE_RETURNERS, ...LATE_RETURNERS]) {
    const m = members[ids[cursor++]]
    m.amberAt = at
    m.returnAt = at + RETURN_AFTER
  }
  const stallers = STALLERS.map((at, k) => {
    const m = members[ids[cursor++]]
    m.amberAt = at
    m.stallAt = at + STALL_FRAMES
    m.fee = STALLER_FEES[k]
    m.plan = FEE_TO_PLAN[m.fee]
    return m
  })
  for (const e of EXPIRE) stallers[e.staller].redAt = e.at
  RECOVER.forEach((k, i) => {
    stallers[k].recoverAt = RECOVER_START + i * RECOVER_STEP
  })
  return members
}

export const MEMBERS: readonly Member[] = build()

export function statusAt(m: Member, frame: number): Status {
  if (frame < m.appearAt) return 'hidden'
  if (m.amberAt === null || frame < m.amberAt) return 'paid'
  if (m.returnAt !== null && frame >= m.returnAt) return 'paid'
  if (m.recoverAt !== null && frame >= m.recoverAt) return 'paid'
  if (m.redAt !== null && frame >= m.redAt) return 'expired'
  return 'due'
}

/** LKR owed by members whose due has stalled and who have not paid since. */
export function uncollectedAt(frame: number): number {
  let sum = 0
  for (const m of MEMBERS) {
    if (m.stallAt === null || frame < m.stallAt) continue
    if (m.recoverAt !== null && frame >= m.recoverAt) continue
    sum += m.fee
  }
  return sum
}

export function countsAt(frame: number): Record<Exclude<Status, 'hidden'>, number> {
  const c = { paid: 0, due: 0, expired: 0 }
  for (const m of MEMBERS) {
    const s = statusAt(m, frame)
    if (s !== 'hidden') c[s]++
  }
  return c
}

export const BILLED = MEMBERS.reduce((s, m) => s + m.fee, 0)

/**
 * Members-table row order after the resolve: the members still needing
 * attention first (the product surfaces them), then the reminded members who
 * just paid, then everyone else.
 */
export const TABLE_ORDER: readonly Member[] = (() => {
  const end = T.resolve.to
  const rank = (m: Member) => {
    const s = statusAt(m, end)
    if (s === 'expired') return 0
    if (s === 'due') return 1
    if (m.recoverAt !== null) return 2
    return 3
  }
  return [...MEMBERS].sort((a, b) => rank(a) - rank(b) || (a.recoverAt ?? 0) - (b.recoverAt ?? 0) || a.id - b.id)
})()

export const formatLkr = (n: number) => `LKR ${n.toLocaleString('en-US')}`
