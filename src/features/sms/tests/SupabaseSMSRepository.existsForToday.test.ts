/**
 * existsForToday — the reminders cron's "already sent today?" check.
 *
 * Failed reminders are logged (rule 2.7), so this check must not count them:
 * a failed row would otherwise read as "already sent" and stop a same-day
 * re-run from retrying the member. Asserted on the query's shape, because a
 * mocked client answers whatever it is asked.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseSMSRepository } from '../services/SupabaseSMSRepository'
import { SmsDeliveryStatus } from '../config/SmsConfig'
import { ReminderType } from '../config/ReminderConfig'

interface Recorded {
  table?: string
  filters: Array<[string, string, unknown]>
}

function mockClient(result: {
  data: unknown
  error: { code?: string; message: string } | null
}) {
  const recorded: Recorded = { filters: [] }
  const builder: Record<string, jest.Mock> = {}
  const chain =
    (op: string) =>
    (col?: string, val?: unknown): Record<string, jest.Mock> => {
      if (col !== undefined) recorded.filters.push([op, col, val])
      return builder
    }
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(chain('eq'))
  builder.gte = jest.fn(chain('gte'))
  builder.neq = jest.fn(chain('neq'))
  builder.limit = jest.fn(() => builder)
  builder.single = jest.fn(() => Promise.resolve(result))
  const from = jest.fn((table: string) => {
    recorded.table = table
    return builder
  })
  return { client: { from } as unknown as SupabaseClient, recorded }
}

describe('SupabaseSMSRepository.existsForToday', () => {
  it("counts only today's non-failed rows for this member and type", async () => {
    const { client, recorded } = mockClient({
      data: { id: 'log-1' },
      error: null,
    })

    await new SupabaseSMSRepository(client).existsForToday(
      'm-1',
      ReminderType.DueToday
    )

    expect(recorded.table).toBe('sms_logs')
    expect(recorded.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'member_id', 'm-1'],
        ['eq', 'sms_type', 'due_today'],
        ['gte', 'sent_at', expect.any(String)],
        ['neq', 'delivery_status', SmsDeliveryStatus.Failed],
      ])
    )
  })

  it('is true when such a row exists', async () => {
    const { client } = mockClient({ data: { id: 'log-1' }, error: null })

    await expect(
      new SupabaseSMSRepository(client).existsForToday(
        'm-1',
        ReminderType.DueToday
      )
    ).resolves.toBe(true)
  })

  it('is false when no row matches (PGRST116)', async () => {
    const { client } = mockClient({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    await expect(
      new SupabaseSMSRepository(client).existsForToday(
        'm-1',
        ReminderType.DueToday
      )
    ).resolves.toBe(false)
  })

  it('throws on any other read error', async () => {
    const { client } = mockClient({
      data: null,
      error: { code: '500', message: 'db down' },
    })

    await expect(
      new SupabaseSMSRepository(client).existsForToday(
        'm-1',
        ReminderType.DueToday
      )
    ).rejects.toThrow('Failed to check SMS existence: db down')
  })
})
