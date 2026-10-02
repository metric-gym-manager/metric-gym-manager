/**
 * Sent Is Not Delivered — 25s at 30fps. See the Video Ideas Registry, film 4.
 *
 * 200 reminders. Statuses use the product's vocabulary (SmsConfig): a message
 * is `sent` when it leaves, then `delivered` or `failed` when the carrier's
 * receipt arrives. Messages with no receipt yet stay `sent`.
 */
export const DURATION = 750
export const TOTAL = 200

export const T = {
  hook: { from: 0, to: 15 },
  sending: { from: 15, to: 90 },
  /** The false finish: everything reads SENT. Held a beat too long. */
  sent: { from: 90, to: 210 },
  receipts: { from: 210, to: 380 },
  failed: { from: 390, to: 540 },
  history: { from: 540, to: 690 },
  card: { from: 690, to: 750 },
} as const

export type Status = 'queued' | 'sent' | 'delivered' | 'failed'
export interface Message {
  id: number
  sentAt: number
  receiptAt: number | null
  outcome: 'delivered' | 'failed' | null
}

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

export const FAILED_COUNT = 9
export const NO_RECEIPT_COUNT = 4
export const DELIVERED_COUNT = TOTAL - FAILED_COUNT - NO_RECEIPT_COUNT

export const MESSAGES: readonly Message[] = (() => {
  const rand = prng(42001)
  const order = Array.from({ length: TOTAL }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const failed = new Set(order.slice(0, FAILED_COUNT))
  const none = new Set(order.slice(FAILED_COUNT, FAILED_COUNT + NO_RECEIPT_COUNT))
  const span = T.sending.to - T.sending.from
  const rspan = T.receipts.to - T.receipts.from
  return Array.from({ length: TOTAL }, (_, id) => {
    const sentAt = T.sending.from + Math.floor((id * span) / TOTAL)
    if (none.has(id)) return { id, sentAt, receiptAt: null, outcome: null }
    // Receipts arrive front-loaded, as carriers report most within seconds.
    const r = Math.pow(rand(), 1.8)
    return { id, sentAt, receiptAt: T.receipts.from + Math.floor(r * rspan), outcome: failed.has(id) ? 'failed' : 'delivered' }
  })
})()

export function statusAt(m: Message, frame: number): Status {
  if (frame < m.sentAt) return 'queued'
  if (m.receiptAt !== null && frame >= m.receiptAt) return m.outcome!
  return 'sent'
}

export function countsAt(frame: number): Record<Status, number> {
  const c: Record<Status, number> = { queued: 0, sent: 0, delivered: 0, failed: 0 }
  for (const m of MESSAGES) c[statusAt(m, frame)]++
  return c
}

const NAMES = ['Kasun Dias', 'Ayesha Fernando', 'Ruwan Silva', 'Nadeesha Jayasuriya', 'Imran Hameed', 'Tharushi Weerasinghe', 'Lahiru Bandara', 'Gayani Ratnayake', 'Shehan Mendis']
/** The failed messages, by name, in receipt order. Names are fictional. */
export const FAILED_ROWS = MESSAGES.filter((m) => m.outcome === 'failed')
  .sort((a, b) => a.receiptAt! - b.receiptAt!)
  .map((m, i) => ({ ...m, name: NAMES[i] }))
