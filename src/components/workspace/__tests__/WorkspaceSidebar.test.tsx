import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import { WORKSPACE_NAV_ITEMS } from '../nav'
import WorkspaceSidebar from '../WorkspaceSidebar'

let pathname = '/dashboard'
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

const subscription = {
  subscription: {
    subscriptionTier: 'enterprise',
    capabilities: { accessControlHardware: true },
  },
}
jest.mock('@/features/subscriptions', () => ({
  __esModule: true,
  useSubscription: () => ({ data: subscription }),
}))

const routes = () => ({
  '/api/auth/profile': apiOk({
    gym_name: 'Titan Fitness',
    gym_address: '12 Galle Rd, Colombo',
    email: 'owner@titan.test',
  }),
})

const renderAt = (path: string, collapsed = false) => {
  pathname = path
  const onToggleCollapse = jest.fn()
  const result = renderScreen(
    <WorkspaceSidebar
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  )
  return { ...result, onToggleCollapse }
}

describe('WorkspaceSidebar', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders every navigation destination as a link', async () => {
    mockFetchRoutes(routes())
    renderAt('/dashboard')

    for (const item of WORKSPACE_NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.name })).toHaveAttribute(
        'href',
        item.href
      )
    }
  })

  /**
   * The pre-migration rail signalled the active item with `rgba(0,0,0,0.09)` —
   * "darken the surface", which is invisible on a near-black ground — and set
   * no `aria-current` at all. The state was therefore unreadable both visually
   * and programmatically. `aria-current` is the half a test can hold.
   */
  it('hides Door Access from a gym without the Enterprise capability', () => {
    // The entry closes OPEN-1 (the page has never been in the navigation), and
    // it is capability-gated: a Lite gym must not be shown a destination that
    // renders an upgrade panel. UX only — the page enforces the same check.
    subscription.subscription.capabilities.accessControlHardware = false
    mockFetchRoutes(routes())
    renderAt('/dashboard')
    expect(
      screen.queryByRole('link', { name: 'Door Access' })
    ).not.toBeInTheDocument()
    subscription.subscription.capabilities.accessControlHardware = true
  })

  it('marks exactly one item as the current page', async () => {
    mockFetchRoutes(routes())
    renderAt('/members')

    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1)
  })

  it('keeps a nested route on its parent nav item', async () => {
    mockFetchRoutes(routes())
    renderAt('/settings/gym')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('marks nothing when the route is outside the navigation', async () => {
    mockFetchRoutes(routes())
    renderAt('/some/unlisted/route')
    expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(0)
  })

  it('labels the rail so it is distinguishable from other navigation', async () => {
    mockFetchRoutes(routes())
    renderAt('/dashboard')
    expect(
      screen.getByRole('navigation', { name: 'Workspace' })
    ).toBeInTheDocument()
  })

  it('shows the gym identity and its tier once the profile arrives', async () => {
    mockFetchRoutes(routes())
    renderAt('/dashboard')

    expect(await screen.findByText('Titan Fitness')).toBeInTheDocument()
    // Location is the last address segment; tier is upper-cased beside it.
    expect(screen.getByText('Colombo · ENTERPRISE')).toBeInTheDocument()
  })

  /**
   * Collapsed, the toggle loses its visible label — so without an explicit
   * accessible name it becomes an unnamed button, which is what the previous
   * hand-written rail shipped.
   */
  it('names the collapse control in both states', async () => {
    mockFetchRoutes(routes())
    const { unmount, onToggleCollapse } = renderAt('/dashboard', false)

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(collapse)
    expect(onToggleCollapse).toHaveBeenCalled()
    unmount()

    renderAt('/dashboard', true)
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' })
    ).toHaveAttribute('aria-expanded', 'false')
  })
})
