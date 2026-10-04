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

import { sendSmsViaTextLk } from '../services/textlk.service'

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
