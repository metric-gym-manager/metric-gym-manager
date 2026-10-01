import { screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen } from '@/test-utils/renderScreen'
import { OVERLAY_HISTORY_MARK } from '@/hooks/useHistoryBack'
import { ViewportTierProvider } from '@/hooks/useViewportTier'
import { useState } from 'react'
import BillingSetupPageClient from '../BillingSetupPageClient'

// The three tabs are code-split and each opens its own queries. This screen's
// own job is the tier switch and the section state, so stub them — and count
// the mounts, because "the hidden tree fetched too" is the defect §8.13 exists
// to remove and a stub that only renders cannot show it.
const mounts: string[] = []
const stub = (name: string) => ({
  __esModule: true,
  default: () => {
    mounts.push(name)
    return <div data-testid={`tab-${name}`} />
  },
})
jest.mock('../PlanTypesTab', () => stub('plans'))
jest.mock('../DiscountsTab', () => stub('discounts'))
jest.mock('../AdmissionFeeTab', () => stub('admission-fee'))

beforeEach(() => {
  mounts.length = 0
  jest.useFakeTimers()
  // jsdom shares ONE history across a file, and `useHistoryBack` drops its
  // entry from a deferred `history.back()`. Without a clean stack per test the
  // hook saw a previous test's marked entry and pushed nothing, and a stale
  // `back()` fired a `popstate` mid-test that closed the section under it —
  // both of which this file hit before the reset existed. The hook's own suite
  // documents the same trap.
  window.history.replaceState({ page: 'list' }, '')
})

afterEach(() => {
  // Unmount INSIDE the fake clock and discard what that queues: Testing
  // Library's own cleanup runs in a top-level `afterEach`, which Jest runs
  // after this one, so a section still open at the end of a test would be torn
  // down under real timers and its deferred `history.back()` would land in the
  // middle of the next test.
  cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('Membership Setup — desktop tier', () => {
  it('offers all three tabs', () => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'desktop' })
    for (const label of ['Plan types', 'Discounts', 'Admission fee']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
    expect(
      screen.getByRole('heading', { name: 'Membership Setup' })
    ).toBeInTheDocument()
  })

  /**
   * The desktop keeps its tabs and its inline sections; the phone menu must
   * not appear beside them. A row and a tab share their label, so this asserts
   * on the ROLE, which only one of the two trees produces.
   */
  it('renders no section menu rows', () => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'desktop' })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})

describe('Membership Setup — phone tier', () => {
  it('lists the three sections as rows with their descriptions', () => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'phone' })

    expect(
      screen.getByRole('heading', { name: 'Membership Setup' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    for (const label of ['Plan types', 'Discounts', 'Admission fee']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(
      screen.getByText('Manage membership plan types and pricing')
    ).toBeInTheDocument()
  })

  /**
   * Audit constraint I.4, and the reason this screen was in scope at all: both
   * trees used to be in the DOM, so the desktop `Tabs` mounted its active tab
   * — `PlanTypesTab`, with its two queries — on every phone visit, for a tab
   * no phone could display. Nothing may mount until a section is opened.
   */
  it('mounts no tab until a section is opened', () => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'phone' })

    expect(mounts).toEqual([])
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it.each([
    ['Plan types', 'plans'],
    ['Discounts', 'discounts'],
    ['Admission fee', 'admission-fee'],
  ])('opens "%s" and mounts only that section', async (label, id) => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'phone' })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }))

    // `findBy`, not `getBy`: the tabs are `next/dynamic` with ssr:false, so the
    // skeleton renders first and the component only appears once the chunk
    // resolves. With `getBy` these passed or failed depending on whether an
    // earlier test in the file had already warmed the module cache.
    expect(await screen.findByTestId(`tab-${id}`)).toBeInTheDocument()
    expect(mounts).toEqual([id])
    // The menu is replaced, not merely scrolled past.
    expect(screen.queryByText('One-time registration fee settings')).toBeNull()
  })

  it('swaps the page header for a back control inside a section', async () => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'phone' })
    fireEvent.click(screen.getByRole('button', { name: /Plan types/ }))
    await screen.findByTestId('tab-plans')

    expect(
      screen.queryByRole('heading', { name: 'Membership Setup' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Membership Setup' })
    ).toBeInTheDocument()
  })

  it('returns to the menu from the back control', async () => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'phone' })
    fireEvent.click(screen.getByRole('button', { name: /Plan types/ }))
    await screen.findByTestId('tab-plans')

    fireEvent.click(screen.getByRole('button', { name: 'Membership Setup' }))

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(
      screen.getByRole('heading', { name: 'Membership Setup' })
    ).toBeInTheDocument()
  })

  /**
   * §8.13's actual requirement: "back returns to the menu". Entering a section
   * pushes one history entry (`useHistoryBack`, the same hook the fullscreen
   * overlays use) and `popstate` closes the section — so the hardware Back
   * button lands on the menu instead of leaving the page, which is what
   * state-driven sections could not do before.
   */
  it('returns to the menu when the browser Back button fires', async () => {
    renderScreen(<BillingSetupPageClient />, { viewport: 'phone' })
    const before = window.history.length

    fireEvent.click(screen.getByRole('button', { name: /Discounts/ }))
    await screen.findByTestId('tab-discounts')
    expect(window.history.length).toBe(before + 1)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByTestId('tab-discounts')).toBeNull()
  })

  /**
   * Widening the viewport with a section open must drop its history entry.
   *
   * The desktop tree renders tabs and ignores `mobileSection`, so the section
   * the entry stands for is no longer on screen — leaving the entry armed
   * would spend the user's next Back on nothing. This is the ONLY thing the
   * hook's `phone` argument changes: an earlier version of this test clicked a
   * desktop tab and asserted no entry was pushed, which passes with or without
   * the guard because the desktop tree never sets the state the hook watches.
   * It was decorative, and a mutation caught it (Verification Directive 3).
   */
  it('drops the section history entry when the tier widens under it', () => {
    // A harness, because `rerender` reuses the original wrapper and so cannot
    // change the tier: the provider nearest the component is the one that
    // decides, and this one is inside `renderScreen`'s.
    function Resizable() {
      const [tier, setTier] = useState<'phone' | 'desktop'>('phone')
      return (
        <ViewportTierProvider tier={tier}>
          <button type="button" onClick={() => setTier('desktop')}>
            widen
          </button>
          <BillingSetupPageClient />
        </ViewportTierProvider>
      )
    }

    // Spied, not read back off `history.state`: jsdom's `history.back()` is
    // asynchronous and does not update the state synchronously, which is why
    // the hook's own suite spies on it too.
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => {})

    renderScreen(<Resizable />, { viewport: 'phone' })
    fireEvent.click(screen.getByRole('button', { name: /Discounts/ }))
    expect(window.history.state).toMatchObject({
      [OVERLAY_HISTORY_MARK]: true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'widen' }))
    act(() => {
      // The hook defers its drop by a tick so a StrictMode re-arm can cancel it.
      jest.advanceTimersByTime(1)
    })

    expect(screen.getByRole('tab', { name: 'Plan types' })).toBeInTheDocument()
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })
})
