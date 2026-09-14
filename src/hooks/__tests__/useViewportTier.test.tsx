import { act, render, screen } from '@testing-library/react'
import { renderScreen } from '@/test-utils/renderScreen'
import {
  PHONE_MEDIA_QUERY,
  ViewportTierProvider,
  useViewportTier,
} from '../useViewportTier'

/**
 * Phase 0 contract for the tier switch (mobile rebuild plan §4, §17).
 *
 * These pin the only thing the skeleton promises: the hook reports the
 * provider's `initialTier` unless an explicit `tier` overrides it, and
 * `renderScreen({ viewport })` is that override. Phase 1 adds the
 * `matchMedia` subscription and extends this file with a mocked media query;
 * the override must keep winning over it, which is why the override cases
 * live here first.
 */
function TierReadout() {
  return <output data-testid="tier">{useViewportTier()}</output>
}

/**
 * A controllable `matchMedia`. jsdom implements none, which is the whole
 * reason the provider carries an explicit override — but the subscription is
 * the part Phase 1 added, and it needs a query to subscribe to.
 */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  let matches = initialMatches
  const queries: string[] = []

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      queries.push(query)
      return {
        get matches() {
          return matches
        },
        media: query,
        addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
          listeners.add(cb),
        removeEventListener: (
          _: string,
          cb: (e: MediaQueryListEvent) => void
        ) => listeners.delete(cb),
      }
    },
  })

  return {
    queries,
    listenerCount: () => listeners.size,
    set(next: boolean) {
      matches = next
      act(() => {
        listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent))
      })
    },
    uninstall() {
      delete (window as { matchMedia?: unknown }).matchMedia
    },
  }
}

describe('useViewportTier (Phase 0 skeleton)', () => {
  it('answers desktop with no provider, so untouched screens render as before', () => {
    render(<TierReadout />)
    expect(screen.getByTestId('tier')).toHaveTextContent('desktop')
  })

  it('reports the provider initialTier', () => {
    render(
      <ViewportTierProvider initialTier="phone">
        <TierReadout />
      </ViewportTierProvider>
    )
    expect(screen.getByTestId('tier')).toHaveTextContent('phone')
  })

  it('an explicit tier overrides initialTier', () => {
    render(
      <ViewportTierProvider initialTier="phone" tier="desktop">
        <TierReadout />
      </ViewportTierProvider>
    )
    expect(screen.getByTestId('tier')).toHaveTextContent('desktop')
  })

  it('the nearest provider wins', () => {
    render(
      <ViewportTierProvider tier="desktop">
        <ViewportTierProvider tier="phone">
          <TierReadout />
        </ViewportTierProvider>
      </ViewportTierProvider>
    )
    expect(screen.getByTestId('tier')).toHaveTextContent('phone')
  })
})

describe('renderScreen({ viewport })', () => {
  it('defaults to the desktop tier', () => {
    renderScreen(<TierReadout />)
    expect(screen.getByTestId('tier')).toHaveTextContent('desktop')
  })

  it('renders the phone tier when asked', () => {
    renderScreen(<TierReadout />, { viewport: 'phone' })
    expect(screen.getByTestId('tier')).toHaveTextContent('phone')
  })

  it('keeps the tier available inside an extra wrapper', () => {
    // Providers a screen test adds (e.g. a modal context) sit inside the tier
    // provider, so a wrapped screen still sees the requested tier.
    renderScreen(<TierReadout />, {
      viewport: 'phone',
      wrapper: ({ children }) => <section>{children}</section>,
    })
    expect(screen.getByTestId('tier')).toHaveTextContent('phone')
  })
})

/**
 * Phase 1: the media-query subscription (plan §4).
 *
 * The provider's `initialTier` is the SSR answer and the value the client
 * hydrates with; the measured value takes over immediately after. That
 * ordering is the mitigation for risk r02 — an effect-based switch would
 * paint the desktop composition first and then flip, which is the hydration
 * flash the member-detail fork carried.
 */
describe('useViewportTier (matchMedia)', () => {
  let mq: ReturnType<typeof installMatchMedia>

  afterEach(() => mq?.uninstall())

  it('measures the tier rather than trusting initialTier', () => {
    mq = installMatchMedia(true)
    render(
      <ViewportTierProvider initialTier="desktop">
        <TierReadout />
      </ViewportTierProvider>
    )
    expect(screen.getByTestId('tier')).toHaveTextContent('phone')
  })

  it('subscribes to the token-derived query, not a hand-typed width', () => {
    mq = installMatchMedia(false)
    render(<TierReadout />)
    expect(mq.queries).toContain(PHONE_MEDIA_QUERY)
    expect(PHONE_MEDIA_QUERY).toBe('(max-width: 767px)')
  })

  it('re-renders when the query changes — a rotated phone, a resized window', () => {
    mq = installMatchMedia(false)
    render(<TierReadout />)
    expect(screen.getByTestId('tier')).toHaveTextContent('desktop')

    mq.set(true)
    expect(screen.getByTestId('tier')).toHaveTextContent('phone')

    mq.set(false)
    expect(screen.getByTestId('tier')).toHaveTextContent('desktop')
  })

  it('lets an explicit tier win over the measurement', () => {
    mq = installMatchMedia(true)
    render(
      <ViewportTierProvider tier="desktop">
        <TierReadout />
      </ViewportTierProvider>
    )
    // renderScreen({ viewport }) is this override. If the media query could
    // beat it, every screen test would measure jsdom's 1024px window instead
    // of rendering the composition it asked for.
    expect(screen.getByTestId('tier')).toHaveTextContent('desktop')
  })

  it('unsubscribes on unmount', () => {
    mq = installMatchMedia(false)
    const { unmount } = render(<TierReadout />)
    expect(mq.listenerCount()).toBe(1)
    unmount()
    expect(mq.listenerCount()).toBe(0)
  })

  it('falls back to initialTier where there is nothing to measure', () => {
    // Server rendering, and jsdom. The hook must not throw on a missing
    // matchMedia — every existing screen test runs without one.
    mq = installMatchMedia(false)
    mq.uninstall()
    render(
      <ViewportTierProvider initialTier="phone">
        <TierReadout />
      </ViewportTierProvider>
    )
    expect(screen.getByTestId('tier')).toHaveTextContent('phone')
  })
})
