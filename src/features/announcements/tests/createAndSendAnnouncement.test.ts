/**
 * @jest-environment node
 */

/**
 * `createAndSendAnnouncement` answers at once and sends afterwards — and the
 * sending must outlive the response.
 *
 * It used to start the send as a bare, un-awaited promise. On Vercel a
 * function can be frozen as soon as its response is returned, so a bulk send
 * could stop part-way: in production the Fitness Empire announcement of
 * 2026-06-27 (213 recipients) never left `sending`. `after()` is Next's way of
 * keeping the function alive for work scheduled after the response.
 *
 * The background send also re-found its announcement by message text, so two
 * announcements with the same text could update each other's row. It now
 * receives the id of the row it was created for.
 */

const after = jest.fn()
jest.mock('next/server', () => ({ after: (cb: () => unknown) => after(cb) }))

const sendSmsViaTextLk = jest.fn()
jest.mock('@/features/sms/services/textlk.service', () => ({
  sendSmsViaTextLk: (...args: unknown[]) => sendSmsViaTextLk(...args),
}))

const smsCreate = jest.fn().mockResolvedValue({ id: 'log' })
jest.mock('@/features/sms', () => ({
  createSMSRepository: () => ({ create: smsCreate }),
  SMSDeliveryStatus: { Sent: 'sent', Failed: 'failed' },
}))

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

/** One recorded Supabase call: table, then each chained method and its args. */
type Call = { table: string; chain: Array<[string, unknown[]]> }
const calls: Call[] = []

const MEMBERS = [
  { id: 'm-1', name: 'Nimal', phone_number: '+94771234567' },
  { id: 'm-2', name: 'Kamala', phone_number: '+94777654321' },
]

/** What each query resolves to, by table and the first method in the chain. */
function resultFor(call: Call): unknown {
  const first = call.chain[0]?.[0]
  if (call.table === 'gyms') return { data: { gym_name: 'Iron House' } }
  if (call.table === 'members') return { data: MEMBERS, error: null }
  if (call.table === 'announcements' && first === 'insert') {
    return { data: { id: 'ann-1', message: 'Closed Monday' }, error: null }
  }
  // A lookup by message would find a DIFFERENT row — the defect this pins.
  if (call.table === 'announcements' && first === 'select') {
    return { data: { id: 'ann-other', session_failures: [] }, error: null }
  }
  return { data: null, error: null }
}

function fakeClient() {
  return {
    from(table: string) {
      const call: Call = { table, chain: [] }
      calls.push(call)
      const builder: Record<string, unknown> = {}
      for (const method of [
        'select',
        'insert',
        'update',
        'eq',
        'in',
        'order',
        'limit',
        'single',
      ]) {
        builder[method] = (...args: unknown[]) => {
          call.chain.push([method, args])
          return builder
        }
      }
      builder.then = (
        resolve: (v: unknown) => unknown,
        reject: (e: unknown) => unknown
      ) => Promise.resolve(resultFor(call)).then(resolve, reject)
      return builder
    },
  }
}

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeClient(),
}))

import { createAndSendAnnouncement } from '../services/announcement.service'

/** Every `.update(...)` made to the announcements table, with its row filter. */
function announcementUpdates() {
  return calls
    .filter((c) => c.table === 'announcements' && c.chain[0]?.[0] === 'update')
    .map((c) => ({
      values: c.chain[0][1][0] as Record<string, unknown>,
      eq: c.chain.find(([m]) => m === 'eq')?.[1],
    }))
}

beforeEach(() => {
  calls.length = 0
  jest.clearAllMocks()
  delete process.env.ENABLE_REAL_SMS
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

describe('createAndSendAnnouncement', () => {
  it('schedules the send with after() and returns before sending', async () => {
    const result = await createAndSendAnnouncement('gym-1', {
      message: 'Closed Monday',
      audience: 'all',
    })

    expect(result).toMatchObject({
      announcement: { id: 'ann-1' },
      recipientCount: 2,
    })
    expect(after).toHaveBeenCalledTimes(1)
    // Nothing is sent or logged until the scheduled work runs.
    expect(smsCreate).not.toHaveBeenCalled()
    expect(announcementUpdates()).toEqual([])
  })

  it('sends to every member and updates the row it created', async () => {
    await createAndSendAnnouncement('gym-1', {
      message: 'Closed Monday',
      audience: 'all',
    })
    const scheduled = after.mock.calls[0][0] as () => Promise<void>

    await scheduled()

    expect(smsCreate).toHaveBeenCalledTimes(2)
    const updates = announcementUpdates()
    expect(updates.length).toBeGreaterThan(0)
    for (const update of updates) {
      expect(update.eq).toEqual(['id', 'ann-1'])
    }
    expect(updates.at(-1)?.values).toMatchObject({
      status: 'completed',
      sent_count: 2,
      failed_count: 0,
    })
  })
})
