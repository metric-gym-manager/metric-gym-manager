/**
 * @jest-environment node
 */

/**
 * Retrying an announcement must send to the member's number AS IT IS NOW.
 *
 * A failed send is recorded in `announcements.session_failures` with the phone
 * number it was sent to. The commonest reason a text fails is a wrong number,
 * and the natural next step is to correct the number on the member and press
 * Retry. The retry used to read the number back from the failure record, so it
 * went to the same wrong number up to three times and the corrected one never
 * received anything.
 */

jest.mock('next/server', () => ({ after: jest.fn() }))

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

type Call = { table: string; chain: Array<[string, unknown[]]> }
const calls: Call[] = []

const OLD_PHONE = '+94770000001'
const NEW_PHONE = '+94771234567'

const failure = (id: string, memberId: string, phone: string) => ({
  id,
  member_id: memberId,
  phone_number: phone,
  retry_count: 0,
  last_error: 'Invalid number',
  last_attempt_at: '2026-11-01T00:00:00.000Z',
})

let sessionFailures: ReturnType<typeof failure>[] = []
let memberRows: Array<{ id: string; phone_number: string }> = []
let memberLookupError: { message: string } | null = null

/** What each query resolves to, by table and the columns it selects. */
function resultFor(call: Call): unknown {
  const first = call.chain[0]
  const columns = first?.[0] === 'select' ? String(first[1][0]) : ''

  if (call.table === 'gyms') return { data: { gym_name: 'Iron House' } }
  if (call.table === 'members') {
    return { data: memberRows, error: memberLookupError }
  }
  if (call.table === 'announcements') {
    if (columns === 'gym_id, message') {
      return { data: { gym_id: 'gym-1', message: 'Closed Monday' } }
    }
    if (columns === 'session_failures') {
      return { data: { session_failures: sessionFailures }, error: null }
    }
    if (columns === 'sent_count, failed_count') {
      return { data: { sent_count: 0, failed_count: sessionFailures.length } }
    }
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

import { retryFailedAnnouncements } from '../services/announcement.service'

/** The numbers the gateway was actually asked to text. */
const textedNumbers = () =>
  sendSmsViaTextLk.mock.calls.map(([args]) => (args as { to: string }).to)

beforeEach(() => {
  calls.length = 0
  jest.clearAllMocks()
  process.env.ENABLE_REAL_SMS = 'true'
  sendSmsViaTextLk.mockResolvedValue({ success: true, message_id: 'tl-1' })
  memberLookupError = null
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  delete process.env.ENABLE_REAL_SMS
})

describe('retryFailedAnnouncements — which number is texted', () => {
  it("texts the member's current number, not the one that failed", async () => {
    sessionFailures = [failure('f1', 'm-1', OLD_PHONE)]
    memberRows = [{ id: 'm-1', phone_number: NEW_PHONE }]

    await retryFailedAnnouncements('ann-1')

    expect(textedNumbers()).toEqual([NEW_PHONE])
  })

  it('logs the retry against the number it was actually sent to', async () => {
    sessionFailures = [failure('f1', 'm-1', OLD_PHONE)]
    memberRows = [{ id: 'm-1', phone_number: NEW_PHONE }]

    await retryFailedAnnouncements('ann-1')

    expect(smsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'm-1', phoneNumber: NEW_PHONE })
    )
  })

  it('still texts a number that has not changed', async () => {
    sessionFailures = [failure('f1', 'm-1', NEW_PHONE)]
    memberRows = [{ id: 'm-1', phone_number: NEW_PHONE }]

    await retryFailedAnnouncements('ann-1')

    expect(textedNumbers()).toEqual([NEW_PHONE])
  })

  it('does not text a member who no longer exists, and counts it as failed', async () => {
    sessionFailures = [
      failure('f1', 'm-1', OLD_PHONE),
      failure('f2', 'm-gone', '+94770000002'),
    ]
    memberRows = [{ id: 'm-1', phone_number: NEW_PHONE }]

    const result = await retryFailedAnnouncements('ann-1')

    expect(textedNumbers()).toEqual([NEW_PHONE])
    expect(textedNumbers()).not.toContain('+94770000002')
    expect(result).toMatchObject({ successCount: 1, failedCount: 1 })
  })

  it("looks the numbers up inside the announcement's own gym", async () => {
    sessionFailures = [failure('f1', 'm-1', OLD_PHONE)]
    memberRows = [{ id: 'm-1', phone_number: NEW_PHONE }]

    await retryFailedAnnouncements('ann-1')

    const lookup = calls.find((c) => c.table === 'members')
    expect(lookup?.chain).toEqual(
      expect.arrayContaining([
        ['eq', ['gym_id', 'gym-1']],
        ['in', ['id', ['m-1']]],
      ])
    )
  })

  it('refuses to send anything if the lookup itself fails', async () => {
    sessionFailures = [failure('f1', 'm-1', OLD_PHONE)]
    memberLookupError = { message: 'connection reset' }

    await expect(retryFailedAnnouncements('ann-1')).rejects.toThrow(
      /connection reset/
    )
    expect(sendSmsViaTextLk).not.toHaveBeenCalled()
  })
})
