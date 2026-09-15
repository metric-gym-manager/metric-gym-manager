'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * The two compositions the workspace renders. One boundary, at the DS
 * `tablet` breakpoint (768 px): `< 768` is `phone`, `≥ 768` is `desktop`
 * (mobile rebuild plan §4, decision d01). There is deliberately no third
 * tier — 768–1023 is the desktop composition with the sidebar collapsed.
 */
export type ViewportTier = 'phone' | 'desktop'

interface ViewportTierContextValue {
  /**
   * The tier the server rendered with. Phase 2 derives it from the request
   * (`sec-ch-ua-mobile` / UA) in `(dashboard)/layout.tsx` so a phone's first
   * HTML is already the phone composition (plan §4, risk r02).
   */
  initialTier: ViewportTier
  /**
   * An explicit tier that wins over everything, including the media query
   * Phase 1 adds. This is how a jsdom test — which has no width — renders a
   * phone composition (audit constraint I.14; `renderScreen({ viewport })`).
   */
  tier?: ViewportTier
}

const ViewportTierContext = createContext<ViewportTierContextValue>({
  initialTier: 'desktop',
})

/**
 * Supplies the viewport tier to everything beneath it.
 *
 * **Phase 0 skeleton.** It carries the provider's contract — `initialTier`
 * as the server-safe starting value and `tier` as an explicit override — and
 * nothing else. It is not mounted anywhere in `src/app` yet; Phase 1 adds the
 * `matchMedia('(max-width: 767px)')` subscription behind `useSyncExternalStore`
 * (server snapshot = `initialTier`), and Phase 2 mounts it in the dashboard
 * layout with the SSR hint. Until then the hook simply reports what it was
 * given, which is exactly what the test harness needs.
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
 * Without a provider the answer is `'desktop'`, so every existing screen test
 * keeps rendering the composition it always did.
 */
export function useViewportTier(): ViewportTier {
  const { initialTier, tier } = useContext(ViewportTierContext)
  return tier ?? initialTier
}
