/**
 * @jest-environment node
 */

/**
 * sendSmsViaTextLk — the one function every real text passes through, so it
 * is where the operator's SMS_DISABLED_GYM_IDS list is enforced. A disabled
 * gym's text is refused before any network call; every other gym's goes out.
 *
 * `fetch` is mocked in every test: nothing here can reach text.lk.
 */

import {
  TEXT_LK_TIMEOUT_ERROR,
  TEXT_LK_TIMEOUT_MS,
  getTextLkBalance,
  sendSmsViaTextLk,
} from '../services/textlk.service'

const DISABLED = 'e0d0a7f9-094c-474c-9277-21cdf1b0bffd'
const CUSTOMER = '481599f6-5134-4152-83b2-6e2dd10e3018'

describe('sendSmsViaTextLk', () => {
  const env = { ...process.env }
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'success', data: { uid: 'uid-1' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    process.env.TEXT_LK_API_KEY = 'test-key'
    process.env.SMS_DISABLED_GYM_IDS = DISABLED
  })

  afterEach(() => {
    fetchMock.mockRestore()
    process.env = { ...env }
  })

  it('refuses a disabled gym without calling text.lk', async () => {
    const result = await sendSmsViaTextLk({
      gymId: DISABLED,
      to: '+94771234567',
      message: 'Hi',
    })

    expect(result).toEqual({
      success: false,
      error: 'SMS disabled for this gym',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends for any other gym', async () => {
    const result = await sendSmsViaTextLk({
      gymId: CUSTOMER,
      to: '+94771234567',
      message: 'Hi',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ success: true, message_id: 'uid-1' })
  })

  it('sends for every gym when nothing is disabled', async () => {
    delete process.env.SMS_DISABLED_GYM_IDS

    await sendSmsViaTextLk({
      gymId: DISABLED,
      to: '+94771234567',
      message: 'Hi',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

/**
 * A gateway that never answers must not hold the request that is waiting on
 * it. Registration awaits the welcome text and bulk import awaits up to 50 at
 * once, so with no timeout a hung text.lk held the desk's request until the
 * platform killed it — after the members were saved, leaving the grid unable
 * to say which rows had succeeded.
 */
describe('text.lk timeout', () => {
  const env = { ...process.env }
  let fetchMock: jest.SpyInstance

  /** A gateway that accepts the connection and never answers. */
  const hangUntilAborted = (_url: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('This operation was aborted', 'AbortError'))
      )
    })

  beforeEach(() => {
    jest.useFakeTimers()
    fetchMock = jest.spyOn(global, 'fetch')
    process.env.TEXT_LK_API_KEY = 'test-key'
    delete process.env.SMS_DISABLED_GYM_IDS
  })

  afterEach(() => {
    jest.useRealTimers()
    fetchMock.mockRestore()
    process.env = { ...env }
  })

  it('gives up on a hung send and says delivery is unknown', async () => {
    fetchMock.mockImplementation(hangUntilAborted)

    const pending = sendSmsViaTextLk({
      gymId: CUSTOMER,
      to: '+94771234567',
      message: 'Hi',
    })
    await jest.advanceTimersByTimeAsync(TEXT_LK_TIMEOUT_MS)

    await expect(pending).resolves.toEqual({
      success: false,
      error: TEXT_LK_TIMEOUT_ERROR,
    })
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('does not give up before the limit', async () => {
    fetchMock.mockImplementation(hangUntilAborted)
    let settled = false

    void sendSmsViaTextLk({
      gymId: CUSTOMER,
      to: '+94771234567',
      message: 'Hi',
    }).then(() => (settled = true))
    await jest.advanceTimersByTimeAsync(TEXT_LK_TIMEOUT_MS - 1)

    expect(settled).toBe(false)
  })

  it('leaves no timer running after a prompt answer', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: { uid: 'u' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await sendSmsViaTextLk({
      gymId: CUSTOMER,
      to: '+94771234567',
      message: 'Hi',
    })

    expect(jest.getTimerCount()).toBe(0)
  })

  it('gives up on a hung balance check too', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation(hangUntilAborted)

    const pending = getTextLkBalance()
    await jest.advanceTimersByTimeAsync(TEXT_LK_TIMEOUT_MS)

    await expect(pending).resolves.toBeNull()
  })
})
