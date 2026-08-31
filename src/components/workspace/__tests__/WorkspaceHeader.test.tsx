import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import WorkspaceHeader from '../WorkspaceHeader'

let pathname = '/members'
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

const profile = {
  gym_name: 'Titan Fitness',
  email: 'owner@titan.test',
  profile_image_url: null,
}

const routes = () => ({
  '/api/auth/profile': apiOk(profile),
  '/api/auth/logout': {},
})

/**
 * `window.location.replace` is the §2.15 auth-boundary navigation. jsdom has no
 * navigation, so it is replaced with a spy — otherwise the call raises a
 * "not implemented" error that surfaces as an unrelated console failure.
 */
const replace = jest.fn()
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, replace, assign: jest.fn(), href: '' },
  })
})

/**
 * The gym name renders twice — once in the breadcrumb and once inside the
 * account menu trigger — so a bare `findByText` is ambiguous. Waiting on the
 * breadcrumb specifically keeps each assertion about the element it names.
 */
const breadcrumb = () => within(screen.getByRole('navigation'))
const waitForProfile = () => breadcrumb().findByText('Titan Fitness')

/**
 * Radix's menu opens on `pointerdown` and jsdom implements neither
 * `PointerEvent` nor the pointer-capture methods Radix calls, so the trigger
 * never reacts to a synthetic click. The keyboard path is a real affordance
 * the menu supports, needs no shimming, and is the one a keyboard user takes.
 */
const signOut = async () => {
  const trigger = screen.getByRole('button', { name: /Titan Fitness|Account/ })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter' })
  return screen.findByRole('menuitem', { name: /Sign out/i })
}

describe('WorkspaceHeader', () => {
  beforeEach(() => {
    pathname = '/members'
  })
  afterEach(() => jest.clearAllMocks())

  it('shows the gym name and the section for the current route', async () => {
    mockFetchRoutes(routes())
    renderScreen(<WorkspaceHeader />)

    expect(await waitForProfile()).toBeInTheDocument()
    expect(breadcrumb().getByText('Members')).toBeInTheDocument()
  })

  it('resolves a nested route to its parent section', async () => {
    pathname = '/settings/gym'
    mockFetchRoutes(routes())
    renderScreen(<WorkspaceHeader />)
    expect(await breadcrumb().findByText('Settings')).toBeInTheDocument()
  })

  it('falls back to a neutral label before the profile loads', () => {
    mockFetchRoutes(routes())
    renderScreen(<WorkspaceHeader />)
    // Rendered on the first paint, before the profile query resolves — the
    // header must not be blank while it waits.
    expect(breadcrumb().getByText('Workspace')).toBeInTheDocument()
  })

  /**
   * The re-entrancy guard, finding A1-1 of the inverted check.
   *
   * The pre-migration header held `isLoggingOut`, returned early on re-entry
   * and disabled the button. `UserMenu` exposes no pending state, so the
   * rewrite fired one POST per click until a `useRef` guard was added — and it
   * had diverged from `MobileTopBar`, which kept its guard the whole time.
   * Nothing else in the repo can see this: logout is idempotent, so the extra
   * requests leave no trace a green suite would notice.
   */
  it('sends one logout request when sign out is used twice in a row', async () => {
    // The request is held open so the second attempt genuinely overlaps the
    // first. Without this the menu has already closed and unmounted, the
    // second click lands on a detached node, and the test passes whether the
    // guard is present or not — which is exactly how it first passed against
    // a build with the guard deleted.
    let release: () => void = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })
    const logoutCalls: string[] = []
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/logout')) {
        logoutCalls.push(url)
        await held
        return { ok: true, status: 200, json: async () => ({}) } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => apiOk(profile),
      } as Response
    }) as unknown as typeof fetch

    renderScreen(<WorkspaceHeader />)
    await waitForProfile()

    fireEvent.click(await signOut())
    // Reopen the menu and sign out again while the first POST is still open —
    // the only way a user can re-enter this handler.
    fireEvent.click(await signOut())

    expect(logoutCalls).toHaveLength(1)

    release()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })

  /**
   * A client-side `router.replace` here serves the stale signed-in Router Cache
   * and leaves the screen unchanged until a manual refresh (§2.15). The whole
   * point of the handler is that it is a full-document navigation.
   */
  it('leaves the session by full-document navigation, not the router', async () => {
    mockFetchRoutes(routes())
    renderScreen(<WorkspaceHeader />)
    await waitForProfile()

    fireEvent.click(await signOut())
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })

  it('still leaves the session when the logout request fails', async () => {
    mockFetchRoutes({
      '/api/auth/profile': apiOk(profile),
      '/api/auth/logout': { status: 500, body: {} },
    })
    renderScreen(<WorkspaceHeader />)
    await waitForProfile()

    fireEvent.click(await signOut())
    // The `finally` branch: a server error must not strand the user in a
    // workspace they believe they have signed out of.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })
})
