import { describe, expect, it } from 'vitest'
import { MESSAGES, countsAt, T, TOTAL, DELIVERED_COUNT, FAILED_COUNT, NO_RECEIPT_COUNT, FAILED_ROWS, DURATION } from './data'

describe('Sent Is Not Delivered data', () => {
  it('every message has left by the false finish', () => {
    expect(countsAt(T.sent.from)).toEqual({ queued: 0, sent: TOTAL, delivered: 0, failed: 0 })
  })

  it('no receipt arrives before the twist', () => {
    for (const m of MESSAGES) if (m.receiptAt !== null) expect(m.receiptAt).toBeGreaterThanOrEqual(T.receipts.from)
  })

  it('ends at the stated split, which always sums to 200', () => {
    const c = countsAt(DURATION - 1)
    expect(c).toEqual({ queued: 0, sent: NO_RECEIPT_COUNT, delivered: DELIVERED_COUNT, failed: FAILED_COUNT })
    expect(c.sent + c.delivered + c.failed).toBe(TOTAL)
  })

  it('every receipt is in before the failed list opens', () => {
    expect(countsAt(T.failed.from)).toEqual(countsAt(DURATION - 1))
  })

  it('names exactly the failed messages', () => {
    expect(FAILED_ROWS).toHaveLength(FAILED_COUNT)
    expect(new Set(FAILED_ROWS.map((r) => r.name)).size).toBe(FAILED_COUNT)
  })
})
