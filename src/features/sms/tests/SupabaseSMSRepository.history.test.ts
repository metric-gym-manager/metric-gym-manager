/**
 * The read and write paths that had drifted from the physical schema.
 *
 * These assert the **shape of the query**, not just its result, because that is
 * where the defects lived: a column name that does not exist, a missing
 * `.select()`, an absent tenant filter. A mocked Supabase client answers happily
 * whatever you ask it for, so a test that only checks the returned rows cannot
 * see any of them — which is exactly why the originals shipped.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SupabaseSMSRepository,
  MEMBER_SMS_HISTORY_COLUMNS,
  SMS_LOG_COLUMNS,
} from '../services/SupabaseSMSRepository'
import { SmsDeliveryStatus } from '../config/SmsConfig'

/**
 * The columns `sms_logs` actually has, transcribed from
 * `information_schema.columns` against the live database on 2026-09-05.
 *
 * Deliberately hand-written rather than derived from the source it is checking:
 * a test that imports the same constant it verifies proves only that the
 * constant equals itself.
 */
const ACTUAL_SMS_LOGS_COLUMNS = [
  'id',
  'member_id',
  'gym_id',
  'sms_type',
  'phone_number',
  'message_body',
  'sent_at',
  'delivery_status',
  'text_lk_message_id',
  'error_message',
]

interface QueryRecord {
  table: string
  select?: string
  eq: Array<[string, unknown]>
  not: Array<[string, string, string]>
  update?: Record<string, unknown>
  order?: [string, unknown]
  range?: [number, number]
  count?: string
}

function mockClient(result: {
  data?: unknown[]
  count?: number
  error?: { message: string } | null
}) {
  const queries: QueryRecord[] = []

  const from = jest.fn((table: string) => {
    const record: QueryRecord = { table, eq: [], not: [] }
    queries.push(record)

    const builder: Record<string, unknown> = {
      select: jest.fn((cols: string, opts?: { count?: string }) => {
        record.select = cols
        if (opts?.count) record.count = opts.count
        return builder
      }),
      update: jest.fn((payload: Record<string, unknown>) => {
        record.update = payload
        return builder
      }),
      eq: jest.fn((col: string, val: unknown) => {
        record.eq.push([col, val])
        return builder
      }),
      not: jest.fn((col: string, op: string, val: string) => {
        record.not.push([col, op, val])
        return builder
      }),
      order: jest.fn((col: string, opts: unknown) => {
        record.order = [col, opts]
        return builder
      }),
      range: jest.fn((a: number, b: number) => {
        record.range = [a, b]
        return Promise.resolve({
          data: result.data ?? [],
          count: result.count ?? 0,
          error: result.error ?? null,
        })
      }),
      then: (resolve: (v: unknown) => unknown) =>
        resolve({
          data: result.data ?? [],
          count: result.count ?? 0,
          error: result.error ?? null,
        }),
    }
    return builder
  })

  return { client: { from } as unknown as SupabaseClient, queries }
}

const historyRow = (over: Record<string, unknown> = {}) => ({
  id: 'log-1',
  sms_type: 'reminder_3day',
  phone_number: '+94770000001',
  message_body: 'Your membership is due in 3 days.',
  sent_at: '2026-09-01T04:30:00.000Z',
  delivery_status: 'delivered',
  text_lk_message_id: 'vendor-1',
  ...over,
})

describe('sms_logs column contract', () => {
  /**
   * The defect that took the endpoint down: `created_at` was requested and the
   * table has no such column, so every request answered
   * `42703: column "created_at" does not exist` and the route returned 500.
   */
  it('declares only columns the table actually has', () => {
    for (const column of SMS_LOG_COLUMNS) {
      expect(ACTUAL_SMS_LOGS_COLUMNS).toContain(column)
    }
    expect([...SMS_LOG_COLUMNS].sort()).toEqual(
      [...ACTUAL_SMS_LOGS_COLUMNS].sort()
    )
  })

  it('has no timestamp other than sent_at', () => {
    // `created_at` and `updated_at` were both referenced by the old code. Neither
    // exists; `sent_at` is the only time this table records.
    expect(SMS_LOG_COLUMNS).not.toContain('created_at')
    expect(SMS_LOG_COLUMNS).not.toContain('updated_at')
    expect(SMS_LOG_COLUMNS).toContain('sent_at')
  })

  /**
   * Rule 2.8: technical infrastructure detail never reaches a gym manager.
   * `error_message` holds raw provider text and belongs to /system-health.
   */
  it('keeps error_message out of the gym-facing projection', () => {
    expect(MEMBER_SMS_HISTORY_COLUMNS).not.toContain('error_message')
    for (const column of MEMBER_SMS_HISTORY_COLUMNS) {
      expect(ACTUAL_SMS_LOGS_COLUMNS).toContain(column)
    }
  })
})

describe('findHistoryForMember', () => {
  it('scopes the query to the gym as well as the member', async () => {
    const { client, queries } = mockClient({ data: [historyRow()], count: 1 })
    await new SupabaseSMSRepository(client).findHistoryForMember('gym-1', 'm-1')

    // Tenant isolation stated in the query, not left entirely to RLS.
    expect(queries[0].eq).toEqual([
      ['gym_id', 'gym-1'],
      ['member_id', 'm-1'],
    ])
  })

  it('requests the sanitised projection, never error_message', async () => {
    const { client, queries } = mockClient({ data: [historyRow()], count: 1 })
    await new SupabaseSMSRepository(client).findHistoryForMember('gym-1', 'm-1')

    expect(queries[0].select).toBe(MEMBER_SMS_HISTORY_COLUMNS.join(', '))
    expect(queries[0].select).not.toContain('error_message')
  })

  it('returns the true total, not the size of the page', async () => {
    const { client } = mockClient({ data: [historyRow()], count: 137 })
    const page = await new SupabaseSMSRepository(client).findHistoryForMember(
      'gym-1',
      'm-1',
      { page: 1, pageSize: 20 }
    )

    // The endpoint this replaces fetched every row and called the array length
    // the total, which is only true while the fetch is unbounded.
    expect(page.totalCount).toBe(137)
    expect(page.entries).toHaveLength(1)
    expect(page.pageCount).toBe(7)
  })

  it('translates page/pageSize into the right row range', async () => {
    const { client, queries } = mockClient({ data: [], count: 0 })
    await new SupabaseSMSRepository(client).findHistoryForMember(
      'gym-1',
      'm-1',
      { page: 3, pageSize: 20 }
    )
    expect(queries[0].range).toEqual([40, 59])
    expect(queries[0].order).toEqual(['sent_at', { ascending: false }])
  })

  it('clamps a hostile page size instead of trusting it', async () => {
    const { client, queries } = mockClient({ data: [], count: 0 })
    await new SupabaseSMSRepository(client).findHistoryForMember(
      'gym-1',
      'm-1',
      { page: 0, pageSize: 10_000 }
    )
    // Page floors at 1; size caps at 100 — so range starts at 0 and spans 100.
    expect(queries[0].range).toEqual([0, 99])
  })

  it('maps a row into the domain shape', async () => {
    const { client } = mockClient({ data: [historyRow()], count: 1 })
    const page = await new SupabaseSMSRepository(client).findHistoryForMember(
      'gym-1',
      'm-1'
    )
    expect(page.entries[0]).toEqual({
      id: 'log-1',
      smsType: 'reminder_3day',
      phoneNumber: '+94770000001',
      messageBody: 'Your membership is due in 3 days.',
      sentAt: new Date('2026-09-01T04:30:00.000Z'),
      deliveryStatus: 'delivered',
      textLkMessageId: 'vendor-1',
    })
  })

  it('surfaces a query failure instead of returning an empty page', async () => {
    const { client } = mockClient({ error: { message: 'boom' } })
    await expect(
      new SupabaseSMSRepository(client).findHistoryForMember('gym-1', 'm-1')
    ).rejects.toThrow('Failed to fetch SMS history: boom')
  })
})

describe('updateDeliveryStatus', () => {
  /**
   * The heart of the seven-month silent failure: PostgREST reports no error for
   * an UPDATE that matched no rows, which is what an RLS refusal looks like.
   * Without `.select()` the caller cannot tell a write from a no-op.
   */
  it('selects the affected ids so a no-op is detectable', async () => {
    const { client, queries } = mockClient({ data: [{ id: 'log-1' }] })
    const rows = await new SupabaseSMSRepository(client).updateDeliveryStatus(
      'vendor-1',
      SmsDeliveryStatus.Delivered
    )

    expect(queries[0].select).toBe('id')
    expect(rows).toBe(1)
  })

  it('reports zero when nothing matched', async () => {
    const { client } = mockClient({ data: [] })
    const rows = await new SupabaseSMSRepository(client).updateDeliveryStatus(
      'never-seen',
      SmsDeliveryStatus.Delivered
    )
    expect(rows).toBe(0)
  })

  it('writes only delivery_status — no phantom updated_at', async () => {
    const { client, queries } = mockClient({ data: [{ id: 'log-1' }] })
    await new SupabaseSMSRepository(client).updateDeliveryStatus(
      'vendor-1',
      SmsDeliveryStatus.Delivered
    )
    // `updated_at` does not exist on this table; writing it made PostgREST
    // reject the whole request.
    expect(queries[0].update).toEqual({ delivery_status: 'delivered' })
  })

  it('refuses to regress a row out of a terminal state', async () => {
    const { client, queries } = mockClient({ data: [] })
    await new SupabaseSMSRepository(client).updateDeliveryStatus(
      'vendor-1',
      SmsDeliveryStatus.Sent
    )
    // Vendor webhooks retry and can arrive out of order; a late SENT must not
    // downgrade a row already DELIVERED.
    expect(queries[0].not).toEqual([
      ['delivery_status', 'in', '(delivered,failed)'],
    ])
  })
})
