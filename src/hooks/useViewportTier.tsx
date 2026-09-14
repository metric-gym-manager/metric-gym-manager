'use client'

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { breakpoints } from '@/components/ui/tokens'

/**
 * The two compositions the workspace renders. One boundary, at the DS
 * `tablet` breakpoint (768 px): `< 768` is `phone`, `≥ 768` is `desktop`
 * (mobile rebuild plan §4, decision d01). There is deliberately no third
 * tier — 768–1023 is the desktop composition with the sidebar collapsed.
 */
export type ViewportTier = 'phone' | 'desktop'

/**
 * The media query the tier is measured with. Derived from the token, not
 * written out: `phone` is the max-width side of `tablet`, and a second
 * hand-typed 767 is how the CSS breakpoint and the JS one drift apart.
 */
export const PHONE_MEDIA_QUERY = `(max-width: ${breakpoints.phoneMax}px)`

interface ViewportTierContextValue {
  /**
   * The tier the server rendered with. Phase 2 derives it from the request
   * (`sec-ch-ua-mobile` / UA) in `(dashboard)/layout.tsx` so a phone's first
   * HTML is already the phone composition (plan §4, risk r02).
   */
  initialTier: ViewportTier
  /**
   * An explicit tier that wins over everything, including the media query.
   * This is how a jsdom test — which has no width — renders a phone
   * composition (audit constraint I.14; `renderScreen({ viewport })`), and
   * how the design-system showcase renders both compositions side by side.
   */
  tier?: ViewportTier
}

const ViewportTierContext = createContext<ViewportTierContextValue>({
  initialTier: 'desktop',
})

/**
 * Subscribe to the phone media query.
 *
 * Module scope so the identity is stable — `useSyncExternalStore` resubscribes
 * whenever `subscribe` changes, and a new closure per render would tear the
 * listener down and rebuild it on every commit.
 *
 * `matchMedia` is absent in jsdom, so this is a no-op there and the snapshot
 * falls back to `initialTier`. That is the correct answer for a test harness
 * that has no width to measure: the tier is *told*, via the provider override.
 */
function subscribeToPhoneQuery(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(PHONE_MEDIA_QUERY)
  mq.addEventListener('change', onStoreChange)
  return () => mq.removeEventListener('change', onStoreChange)
}

/** The measured tier, or `null` where there is nothing to measure. */
function measuredTier(): ViewportTier | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null
  return window.matchMedia(PHONE_MEDIA_QUERY).matches ? 'phone' : 'desktop'
}

/**
 * Supplies the viewport tier to everything beneath it.
 *
 * `initialTier` is the server's answer and the value the client hydrates
 * with; `tier` overrides both and never measures anything.
 */
export function ViewportTierProvider({
  initialTier = 'desktop',
  tier,
  children,
}: {
  initialTier?: ViewportTier
  tier?: ViewportTier
  children: ReactNode
}) {
  return (
    <ViewportTierContext.Provider value={{ initialTier, tier }}>
      {children}
    </ViewportTierContext.Provider>
  )
}

/**
 * Which composition to render: `'phone'` or `'desktop'`.
 *
 * A component reads this only to choose *which* tree to render — a list of
 * `ListRow`s instead of a `<table>`, a compact chart axis. Sizing, spacing
 * and visibility stay in CSS (`phone:` utilities). Never read
 * `window.innerWidth` in a component; it is untestable in jsdom and flashes on
 * hydration, which is the defect the member-detail fork carried (audit §I.1).
 *
 * Hydration safety is the whole reason this goes through
 * `useSyncExternalStore` rather than an effect: the server snapshot is the
 * provider's `initialTier`, so the first client render matches the HTML
 * exactly, and React swaps in the measured value immediately afterwards
 * (risk r02). An effect would paint the desktop composition first and then
 * flip, which is the flash this replaces.
 *
 * Without a provider the answer is `'desktop'`, so every existing screen test
 * keeps rendering the composition it always did.
 */
export function useViewportTier(): ViewportTier {
  const { initialTier, tier } = useContext(ViewportTierContext)

  const getSnapshot = useCallback(
    () => measuredTier() ?? initialTier,
    [initialTier]
  )
  const getServerSnapshot = useCallback(() => initialTier, [initialTier])

  const measured = useSyncExternalStore(
    subscribeToPhoneQuery,
    getSnapshot,
    getServerSnapshot
  )

  return tier ?? measured
}
