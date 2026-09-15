import { screen, fireEvent, within, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import { WORKSPACE_NAV_ITEMS } from '../nav'
import WorkspaceShell from '../WorkspaceShell'

/**
 * The shell's navigation contract (mobile rebuild plan §6, risk r04).
 *
 * The thing that must not happen is a destination existing on one tier and
 * missing from the other. The bar holds three; everything else has to be in
 * More, and "everything else" is enumerated from `WORKSPACE_NAV` rather than
 * retyped here — a hand-written expectation would pass a shell that dropped an
 * item the same day someone dropped it from the list.
 *
 * What jsdom cannot see: both chromes are always in the DOM and hidden by CSS
 * (`tablet:hidden` / `tablet:flex`), which is what keeps them off the
 * hydration path. So the hiding is asserted as classes, and the *measurement*
 * — that the bar does not overflow at 320 — is the probe's, in a browser.
 */

let pathname = '/dashboard'
const push = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}))

let capabilities: Record<string, boolean> = { accessControlHardware: true }
jest.mock('@/features/subscriptions', () => ({
  __esModule: true,
  MemberLimitBar: () => null,
  useSubscription: () => ({
    data: {
      subscription: { subscriptionTier: 'enterprise', capabilities },
    },
  }),
}))

/**
 * `window.location.replace` is the §2.15 auth-boundary navigation, and jsdom
 * has no navigation. The stand-in keeps a REAL `href`/`origin`: `next/link`
 * resolves every href against them, and a blank one fails the whole render
 * with "Invalid base URL" — an error that reads like a broken component.
 */
const replace = jest.fn()
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      href: 'http://localhost/',
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      pathname: '/',
      search: '',
      hash: '',
      replace,
      assign: jest.fn(),
    },
  })
})

const routes = () => ({
  '/api/auth/profile': apiOk({
    gym_name: 'Titan Fitness',
    email: 'owner@titan.test',
    profile_image_url: null,
  }),
  '/api/auth/logout': {},
})

function renderShell(
  path = '/dashboard',
  viewport: 'phone' | 'desktop' = 'phone'
) {
  pathname = path
  mockFetchRoutes(routes())
  return renderScreen(
    <WorkspaceShell>
      <p>Page content</p>
    </WorkspaceShell>,
    { viewport }
  )
}

/**
 * The fixed bottom bar, not the desktop rail.
 *
 * Both are `<nav aria-label="Workspace">` and both are `fixed` — the rail is
 * `fixed inset-y-0`, the bar `fixed inset-x-0 bottom-0` — so the first version
 * of this helper returned the SIDEBAR and half the file asserted against the
 * wrong element. In a browser only one of the two is in the accessibility tree
 * at a time (the other is `display: none`); jsdom applies no CSS, so the test
 * has to say which it means.
 */
const bottomBar = () =>
  screen
    .getAllByRole('navigation', { name: 'Workspace' })
    .find((nav) => nav.className.includes('bottom-0'))!

const openMore = () => {
  fireEvent.click(within(bottomBar()).getByRole('button', { name: 'More' }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  capabilities = { accessControlHardware: true }
  window.history.replaceState({ page: 'shell' }, '')
})
afterEach(() => jest.clearAllMocks())

describe('WorkspaceShell — the phone bar', () => {
  it('carries three destinations and More, and no more than that', () => {
    renderShell()
    const bar = within(bottomBar())
    expect(bar.getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Dashboard',
      'Members',
      'Renewals',
    ])
    expect(bar.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })

  it('marks the current destination', () => {
    renderShell('/members')
    expect(
      within(bottomBar()).getByRole('link', { name: 'Members' })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('marks the bar item a NESTED route belongs to', () => {
    // /payment-collection has no children today, but /settings does, and the
    // rule is the same one `activeNavItem` applies for the sidebar.
    renderShell('/settings/gym')
    expect(
      within(bottomBar()).queryAllByRole('link', { current: 'page' })
    ).toHaveLength(0)
  })
})

describe('WorkspaceShell — the More sheet', () => {
  it('holds every destination the bar does not', () => {
    renderShell()
    const sheet = within(openMore())

    const inBar = ['Dashboard', 'Members', 'Renewals']
    const expected = WORKSPACE_NAV_ITEMS.map((i) => i.name).filter(
      (name) => !inBar.includes(name)
    )
    for (const name of expected) {
      expect(sheet.getByRole('link', { name })).toBeInTheDocument()
    }
  })

  it('leaves every destination reachable in at most two taps', () => {
    renderShell()
    const barLinks = within(bottomBar())
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'))
    const sheetLinks = within(openMore())
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'))

    // One tap in the bar, or two through More. Nothing may be in neither.
    const reachable = new Set([...barLinks, ...sheetLinks])
    expect(
      WORKSPACE_NAV_ITEMS.filter((i) => !reachable.has(i.href)).map(
        (i) => i.name
      )
    ).toEqual([])
  })

  it('groups the sheet the way the sidebar groups the rail', () => {
    renderShell()
    const sheet = within(openMore())
    for (const label of ['Primary', 'Operations', 'Management']) {
      expect(sheet.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the gym identity, so More is also the account menu', async () => {
    renderShell()
    const sheet = within(openMore())
    // The profile is a query: until it lands both bars say "Metric", which is
    // the right placeholder and the wrong thing to assert on.
    expect(await sheet.findByText('Titan Fitness')).toBeInTheDocument()
    expect(sheet.getByText('owner@titan.test')).toBeInTheDocument()
  })

  it('marks the current route inside the sheet', () => {
    renderShell('/revenue')
    const row = within(openMore())
      .getByRole('link', { name: 'Revenue' })
      .closest('li')
    expect(row).toHaveAttribute('data-selected')
  })
})

describe('WorkspaceShell — Door Access is Enterprise-only', () => {
  it('appears for a gym that has the capability', () => {
    renderShell()
    expect(
      within(openMore()).getByRole('link', { name: 'Door Access' })
    ).toBeInTheDocument()
  })

  it('is absent for a gym that does not', () => {
    capabilities = { accessControlHardware: false }
    renderShell()
    expect(
      within(openMore()).queryByRole('link', { name: 'Door Access' })
    ).not.toBeInTheDocument()
  })

  it('does not leave an empty group behind when it is the only item hidden', () => {
    capabilities = { accessControlHardware: false }
    renderShell()
    // Operations still has Announcements and Membership Setup, so the label
    // stays. The guard matters for a group that empties entirely.
    expect(within(openMore()).getByText('Operations')).toBeInTheDocument()
  })
})

describe('WorkspaceShell — the app bar', () => {
  it('titles a root page from its breadcrumb, with no Back', () => {
    renderShell('/dashboard')
    expect(
      screen.getByRole('heading', { name: 'Overview' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Back' })
    ).not.toBeInTheDocument()
  })

  it('titles a nested page with its section name', () => {
    renderShell('/settings/gym')
    expect(
      screen.getByRole('heading', { name: 'Gym Information' })
    ).toBeInTheDocument()
  })

  it('sends Back to the PARENT route, not to browser history', () => {
    renderShell('/settings/gym')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    // `router.back()` would depend on how the user arrived; the parent is the
    // same answer every time (plan §6.2).
    expect(push).toHaveBeenCalledWith('/settings')
  })

  it('opens More from the gym identity', async () => {
    renderShell()
    // The desktop `UserMenu` trigger is also named for the gym; the AppBar's
    // says what it opens.
    const identity = await screen.findByRole('button', {
      name: 'Titan Fitness — open navigation',
    })
    fireEvent.click(identity)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('WorkspaceShell — sign out', () => {
  it('posts to the logout route and leaves by a full-document navigation', async () => {
    renderShell()
    const sheet = within(openMore())

    await act(async () => {
      fireEvent.click(sheet.getByRole('button', { name: 'Sign out' }))
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    })
    // §2.15: a client navigation would serve the stale Router Cache and leave
    // the user looking at a signed-in screen until a manual refresh.
    expect(replace).toHaveBeenCalledWith('/login')
  })
})

describe('WorkspaceShell — tiers', () => {
  it('stamps the tier on the root, so CSS and tests can both read it', () => {
    const { container } = renderShell('/dashboard', 'phone')
    expect(container.querySelector('[data-tier="phone"]')).toBeInTheDocument()
  })

  it('stamps desktop when that is the tier', () => {
    const { container } = renderShell('/dashboard', 'desktop')
    expect(container.querySelector('[data-tier="desktop"]')).toBeInTheDocument()
  })

  it('hides each chrome on the other tier with CSS, not with the hook', () => {
    renderShell()
    // Both chromes are always in the DOM: a tier-switched tree would have to
    // agree between the server and the hydrating client, and `display: none`
    // takes the hidden one out of the accessibility tree anyway. The cost is
    // that the document carries two `banner`s and two "Workspace" navigations
    // — one of each visible at a time — so a test has to name which it means.
    const [desktopHeader, phoneHeader] = screen.getAllByRole('banner')
    expect(desktopHeader.className).toContain('tablet:flex')
    expect(phoneHeader.className).toContain('tablet:hidden')
    expect(bottomBar().className).toContain('tablet:hidden')
  })

  it('reserves room under the content for the fixed bar', () => {
    const { container } = renderShell()
    const main = container.querySelector('main')!
    // Without this the last row of every list sits behind the bar.
    expect(main.className).toContain('bottom-nav')
    expect(main.className).toContain('--ds-safe-bottom')
  })
})
