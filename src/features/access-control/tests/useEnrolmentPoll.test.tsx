/**
 * The enrolment wait.
 *
 * This hook exists because the vendor can only tell us a reader *accepted* the
 * request. The template appears when a human puts a finger on a sensor, and
 * nothing pushes us that news — so the desk polls.
 *
 * The behaviour worth pinning is what happens when the wait does **not**
 * succeed. Timing out must not read as failure and must not undo anything: the
 * detection behind the poll is additive, so a member who did present a finger
 * after we stopped watching is still enrolled. Being wrong in that direction
 * leaves a stale screen; being wrong in the other tells a member to re-enrol a
 * finger the reader already holds.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEnrolmentPoll } from '@/features/access-control/hooks/useAccessControl'
import { ENROLMENT_POLL_TIMEOUT_MS } from '@/features/access-control/config/AccessControlConfig'

const startEnrolment = jest.fn()
const getEnrolment = jest.fn()

jest.mock('@/features/access-control/services/access-control.service', () => ({
  startMemberEnrolment: (...args: unknown[]) => startEnrolment(...args),
  getMemberEnrolment: (...args: unknown[]) => getEnrolment(...args),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  startEnrolment.mockResolvedValue({ awaitingFinger: true })
  getEnrolment.mockResolvedValue({ enrolled: false })
})

afterEach(() => {
  jest.useRealTimers()
})

/** Advance fake timers while letting the awaited promises in between settle. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

describe('useEnrolmentPoll', () => {
  it('waits for a finger after the reader accepts the request', async () => {
    const { result } = renderHook(() => useEnrolmentPoll('member-1'), {
      wrapper,
    })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    expect(startEnrolment).toHaveBeenCalledWith('member-1', {
      deviceId: 'device-1',
    })
    // Not "enrolled". The reader is merely listening; the template does not
    // exist until the member touches it.
    expect(result.current.state).toBe('awaiting')
  })

  it('reports the enrolment once the template appears', async () => {
    const { result } = renderHook(() => useEnrolmentPoll('member-1'), {
      wrapper,
    })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    getEnrolment.mockResolvedValue({ enrolled: true })
    await advance(5_000)

    await waitFor(() => expect(result.current.state).toBe('enrolled'))
  })

  it('keeps waiting when a poll request fails', async () => {
    const { result } = renderHook(() => useEnrolmentPoll('member-1'), {
      wrapper,
    })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    getEnrolment.mockRejectedValue(new Error('network blip'))
    await advance(5_000)

    // A dropped request is not a failed enrolment — the member is still
    // standing at the reader either way.
    expect(result.current.state).toBe('awaiting')

    getEnrolment.mockResolvedValue({ enrolled: true })
    await advance(5_000)

    await waitFor(() => expect(result.current.state).toBe('enrolled'))
  })

  it('gives up as timed-out, never as failed', async () => {
    const { result } = renderHook(() => useEnrolmentPoll('member-1'), {
      wrapper,
    })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    await advance(ENROLMENT_POLL_TIMEOUT_MS + 5_000)

    await waitFor(() => expect(result.current.state).toBe('timed-out'))
    // Distinct from 'failed' on purpose: nothing went wrong, and the member
    // may well be enrolled by the time anyone looks again.
    expect(result.current.state).not.toBe('failed')
  })

  it('stops polling once it has timed out', async () => {
    const { result } = renderHook(() => useEnrolmentPoll('member-1'), {
      wrapper,
    })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    await advance(ENROLMENT_POLL_TIMEOUT_MS + 5_000)
    await waitFor(() => expect(result.current.state).toBe('timed-out'))

    const callsAtTimeout = getEnrolment.mock.calls.length
    await advance(60_000)

    expect(getEnrolment.mock.calls.length).toBe(callsAtTimeout)
  })

  it('surfaces a refused request with the server’s wording', async () => {
    startEnrolment.mockRejectedValue(
      new Error('Access control is not set up for this gym yet')
    )

    const { result } = renderHook(() => useEnrolmentPoll('member-1'), {
      wrapper,
    })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    expect(result.current.state).toBe('failed')
    expect(result.current.error).toBe(
      'Access control is not set up for this gym yet'
    )
    // Never started waiting, so nothing should be polling.
    expect(getEnrolment).not.toHaveBeenCalled()
  })

  it('stops polling when the panel unmounts', async () => {
    const { result, unmount } = renderHook(() => useEnrolmentPoll('member-1'), {
      wrapper,
    })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    await advance(5_000)
    const callsBeforeUnmount = getEnrolment.mock.calls.length

    unmount()
    await advance(30_000)

    // A poll that outlived its modal would keep writing to the cache for a
    // member nobody is looking at.
    expect(getEnrolment.mock.calls.length).toBe(callsBeforeUnmount)
  })

  it('does nothing at all without a member', async () => {
    const { result } = renderHook(() => useEnrolmentPoll(null), { wrapper })

    await act(async () => {
      await result.current.start({ deviceId: 'device-1' })
    })

    expect(startEnrolment).not.toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
  })
})
