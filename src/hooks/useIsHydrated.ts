'use client'

import { useSyncExternalStore } from 'react'

// Nothing to subscribe to: the value flips exactly once, when React switches
// from `getServerSnapshot` to `getSnapshot` after hydration. A no-op
// unsubscribe is the whole contract. Defined at module scope so the reference
// is stable — an inline arrow would resubscribe on every render.
const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * `false` while rendering on the server and during the hydrating client render,
 * `true` immediately afterwards.
 *
 * ## What it is for
 *
 * Anything whose *output* depends on state the server cannot share with the
 * client — the current time, a client-only cache, `window` — is a hydration
 * mismatch waiting to happen: React compares the two renders, finds different
 * markup, and throws the tree away. Gate that decision on this hook and the
 * server render and the first client render agree by construction; the real
 * value appears on the render straight after.
 *
 * ## Why not the obvious alternatives
 *
 * `useState(false)` + `useEffect(() => setState(true))` does the same job and
 * is what most codebases reach for, but `react-hooks/set-state-in-effect`
 * rejects it. `suppressHydrationWarning` only silences the warning for text
 * and leaves the server's value on screen, which is wrong when the server's
 * value is wrong. This is the mechanism React provides for exactly this case.
 *
 * @example
 * const hydrated = useIsHydrated()
 * if (!hydrated) return null // matches the server; decide on the next render
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
