import { render, screen } from '@testing-library/react'
import { renderScreen } from '@/test-utils/renderScreen'
import { ViewportTierProvider, useViewportTier } from '../useViewportTier'

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
