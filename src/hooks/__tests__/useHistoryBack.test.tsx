import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useState } from 'react'
import { OVERLAY_HISTORY_MARK, useHistoryBack } from '../useHistoryBack'

/**
 * `useHistoryBack` — the one implementation of "Back closes the overlay"
 * (mobile rebuild plan §5.3, §14; risk r03 "double back, stuck entries").
 *
 * The behaviour these pin was **observed in the real App Router** by VERIFY
 * spike (a), not inferred: `tests/e2e/spikes/app-router-history.spec.ts`. What
 * jsdom can check is the hook's own state machine — one entry per open, the
 * entry dropped exactly once, and no close from a popstate that is not ours.
 * What it cannot check is Next adopting the pushed entry without navigating;
 * that is the spike's job, and neither test replaces the other.
 */

function Overlay({
  enabled,
  onClosed,
}: {
  enabled?: boolean
  onClosed?: () => void
}) {
  const [open, setOpen] = useState(true)
  useHistoryBack(
    open,
    () => {
      setOpen(false)
      onClosed?.()
    },
    enabled
  )
  return <output data-testid="state">{open ? 'open' : 'closed'}</output>
}

const state = () => screen.getByTestId('state').textContent

/** Let the cleanup's deferred `history.back()` run. */
async function flushDrop() {
  await act(async () => {
    jest.advanceTimersByTime(1)
  })
}

describe('useHistoryBack', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // A clean stack for every test: jsdom shares one history across a file.
    window.history.replaceState({ page: 'list' }, '')
  })

  afterEach(() => {
    // Unmount INSIDE the fake clock and discard what that queues. Testing
    // Library's own cleanup runs in a top-level `afterEach`, which Jest runs
    // *after* this block's — so an overlay still open at the end of a test
    // was being torn down under real timers, and its deferred
    // `history.back()` landed in the middle of the NEXT test. Two tests
    // failed with "expected 1 call, received 2" before this existed.
    cleanup()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('pushes exactly one marked entry when the overlay opens', () => {
    render(<Overlay />)
    expect(window.history.state).toMatchObject({
      [OVERLAY_HISTORY_MARK]: true,
    })
  })

  it('closes on popstate — this is the hardware Back button', () => {
    render(<Overlay />)
    expect(state()).toBe('open')

    act(() => {
      // What the browser does on Back: leave our entry, then fire popstate.
      window.history.replaceState({ page: 'list' }, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    expect(state()).toBe('closed')
  })

  it('does not go back again after Back already left the entry', async () => {
    const back = jest.spyOn(window.history, 'back')
    render(<Overlay />)

    act(() => {
      window.history.replaceState({ page: 'list' }, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    await flushDrop()

    // Two backs for one Back press is how an overlay swallows the user's
    // next navigation — the list closes AND the route changes.
    expect(back).not.toHaveBeenCalled()
    back.mockRestore()
  })

  it('drops its entry when the overlay is closed from the UI', async () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => {})
    const { rerender } = render(<Overlay />)

    // Closing without a popstate: the Close button, not the Back button.
    rerender(<></>)
    await flushDrop()

    // Left in place, the dead entry swallows the user's next Back press.
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })

  it('ignores a popstate that is not ours once closed (forward re-entry)', () => {
    const onClosed = jest.fn()
    render(<Overlay onClosed={onClosed} />)

    act(() => {
      window.history.replaceState({ page: 'list' }, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    expect(onClosed).toHaveBeenCalledTimes(1)

    act(() => {
      // Forward: the browser re-enters the dead entry and fires popstate
      // carrying the overlay's own state (spike finding).
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: { [OVERLAY_HISTORY_MARK]: true },
        })
      )
    })
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('does nothing at all when disabled — center and sheet placements', async () => {
    const back = jest.spyOn(window.history, 'back')
    const push = jest.spyOn(window.history, 'pushState')
    const onClosed = jest.fn()

    const { rerender } = render(<Overlay enabled={false} onClosed={onClosed} />)
    expect(push).not.toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    expect(onClosed).not.toHaveBeenCalled()

    rerender(<></>)
    await flushDrop()
    expect(back).not.toHaveBeenCalled()

    back.mockRestore()
    push.mockRestore()
  })
})
