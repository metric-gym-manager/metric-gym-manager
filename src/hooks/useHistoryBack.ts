'use client'

import { useEffect, useRef } from 'react'

/**
 * Marker written onto the history entry an overlay pushes for itself.
 *
 * Next copies its own internals (`__NA`, the router tree) *onto* the state we
 * push rather than replacing it, so this survives and is how the hook
 * recognises its own entry later. Verified in the real router, not assumed:
 * `tests/e2e/spikes/app-router-history.spec.ts`.
 */
export const OVERLAY_HISTORY_MARK = '__metricOverlayEntry'

/**
 * The one drop waiting to run, whichever overlay queued it. Shared, not per
 * overlay, because the overlay that arms next must be able to cancel it: that
 * is how an entry is handed over (behaviour 5).
 */
let pendingDrop: ReturnType<typeof setTimeout> | null = null

function isOverlayEntry(): boolean {
  if (typeof window === 'undefined') return false
  const state = window.history.state as Record<string, unknown> | null
  return state?.[OVERLAY_HISTORY_MARK] === true
}

/**
 * Close a screen-filling overlay with the hardware/browser Back button
 * (mobile rebuild plan §5.3, §14, §17).
 *
 * On a phone, Back is how people dismiss a screen. An overlay that ignores it
 * navigates the user off the list they were working in and loses its state —
 * so a fullscreen overlay pushes one history entry when it opens and closes
 * itself when that entry is popped. **One implementation**: `Modal
 * placement="fullscreen"` and Phase 2's More sheet / Membership Setup
 * sections all call this hook; nothing re-implements it.
 *
 * Four behaviours, each observed in the App Router by VERIFY spike (a) rather
 * than inferred:
 *
 * 1. **Push with no URL.** `pushState(state, '')` is adopted by Next without
 *    dispatching a navigation; pushing *with* the same URL is adopted too but
 *    dispatches a same-URL restore — a router render for nothing.
 * 2. **Back fires `popstate` on the same URL**, with no navigation and no
 *    reload, so the list underneath survives untouched.
 * 3. **Closing from the overlay's own button** must drop the entry it added,
 *    or the next Back is swallowed doing nothing.
 * 4. **Forward after a back-close** re-enters the dead entry and fires
 *    `popstate` carrying the overlay's own state. The listener only exists
 *    while the overlay is open, so that is a no-op, which is what it must be.
 *
 * And one more, which no spike observed and a gym owner did:
 *
 * 5. **Handoff.** One overlay closing as another opens in the same commit —
 *    Member Details giving way to Edit Member — hands its entry over. The
 *    opener cancels the closer's pending drop and adopts the entry, so the one
 *    entry now belongs to the overlay on screen. While the pending drop was
 *    per overlay, the closer's `history.back()` landed a tick later and the
 *    opener took that popstate for the Back button: on a phone, Edit closed
 *    the member instead of editing it (2026-11-05).
 *
 * @param open    Whether the overlay is currently open.
 * @param onClose Called when Back is pressed. Must close the overlay — i.e.
 *                flip whatever drives `open`.
 * @param enabled Default `true`. `Modal` passes `false` for the `center` and
 *                `sheet` placements: only a screen-filling overlay claims the
 *                Back button.
 */
export function useHistoryBack(
  open: boolean,
  onClose: () => void,
  enabled = true
): void {
  // Latest callback without re-running the arm effect: re-running it would
  // push a second entry every time the parent re-renders with a new closure.
  // Synced in its own effect rather than during render — a ref written while
  // rendering is read by whatever commits first, and React lints against it.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!enabled || !open || typeof window === 'undefined') return

    // A drop still queued is cancelled, and its entry adopted below:
    //  - React StrictMode runs mount effects twice in development (effect →
    //    cleanup → effect, synchronously), so this overlay's own first cleanup
    //    is still queued; pushing a second entry and popping the first closed
    //    the overlay by itself, in dev only;
    //  - another overlay closed in this same commit (behaviour 5, handoff).
    if (pendingDrop !== null) {
      clearTimeout(pendingDrop)
      pendingDrop = null
    }
    if (!isOverlayEntry()) {
      window.history.pushState({ [OVERLAY_HISTORY_MARK]: true }, '')
    }

    const onPopState = () => onCloseRef.current()
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      // Deferred by a tick so the StrictMode re-arm above, or an overlay
      // opening in this same commit, can cancel it. The guard inside makes the
      // delay safe in every other case. Overlays share at most one entry, so
      // one drop is enough: a second overlay closing in the same commit must
      // not queue another step back.
      if (pendingDrop !== null) return
      pendingDrop = setTimeout(() => {
        pendingDrop = null
        // Only when our entry is still the current one:
        //  - closed by Back — the browser already left it;
        //  - closed by an action that also navigated — a new entry is on top,
        //    and going back would undo the navigation.
        if (isOverlayEntry()) window.history.back()
      }, 0)
    }
  }, [open, enabled])

  // A component unmounted mid-close leaves the timer armed; clearing it on
  // unmount would also cancel the legitimate drop, so it is deliberately left
  // to fire — the guard above decides whether it does anything.
}
