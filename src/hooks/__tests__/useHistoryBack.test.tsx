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

function Armed({ open, onClose }: { open: boolean; onClose: () => void }) {
  useHistoryBack(open, onClose)
  return null
}

/** Two overlays, the first closing as the second opens: one state update. */
function Swap({ onSecondClosed }: { onSecondClosed: () => void }) {
  const [which, setWhich] = useState<'first' | 'second' | 'none'>('first')
  return (
    <>
      <Armed open={which === 'first'} onClose={() => setWhich('none')} />
      <Armed
        open={which === 'second'}
        onClose={() => {
          setWhich('none')
          onSecondClosed()
        }}
      />
      <button onClick={() => setWhich('second')}>swap</button>
      <output data-testid="which">{which}</output>
    </>
  )
}

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
    // A test that fails before its own `mockRestore()` would otherwise hand
    // its spy, calls and all, to the next test's `spyOn`.
    jest.restoreAllMocks()
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

  /**
   * Member Details closing as Edit Member opens, in one commit, both fullscreen
   * on a phone. The opener adopted the detail's entry, then the detail's
   * deferred drop went back, and the opener took that popstate for the Back
   * button and closed too: Edit closed the member instead of editing it.
   */
  it('hands its entry to an overlay that opens as it closes', async () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => {})
    const onSecondClosed = jest.fn()
    render(<Swap onSecondClosed={onSecondClosed} />)
    expect(window.history.state).toMatchObject({ [OVERLAY_HISTORY_MARK]: true })

    act(() => {
      screen.getByText('swap').click()
    })
    await flushDrop()

    expect(back).not.toHaveBeenCalled()
    expect(screen.getByTestId('which').textContent).toBe('second')
    expect(window.history.state).toMatchObject({ [OVERLAY_HISTORY_MARK]: true })

    // The entry is the second overlay's now: Back closes it, once.
    act(() => {
      window.history.replaceState({ page: 'list' }, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    await flushDrop()
    expect(onSecondClosed).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('which').textContent).toBe('none')
    expect(back).not.toHaveBeenCalled()
    back.mockRestore()
  })

  it('goes back once when two overlays sharing the entry close together', async () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => {})
    const { rerender } = render(
      <>
        <Armed open onClose={() => {}} />
        <Armed open onClose={() => {}} />
      </>
    )

    // One entry for both (the second adopts it), so one step back for both.
    rerender(<></>)
    await flushDrop()

    expect(back).toHaveBeenCalledTimes(1)
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
