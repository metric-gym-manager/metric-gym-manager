import '@testing-library/jest-dom'
import RootDashboardPage from '../page'

const redirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
}))

/**
 * The workspace root is a bare `redirect()`, which is why it stayed invisible:
 * UI3's original filter required a path segment between the route group and
 * `page.tsx`, so every route-group ROOT page was silently exempt from the rule.
 *
 * It is worth a test on its own terms. This is where an authenticated user
 * lands on `/`, and the destination is a bare string — pointing it at a route
 * that no longer exists produces a redirect loop or a 404 on the first screen
 * after login, with nothing in the suite to notice.
 */
describe('Workspace root route', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sends an authenticated visitor to the dashboard', () => {
    RootDashboardPage()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects unconditionally — it renders nothing of its own', () => {
    // Any branch here would be a second landing rule competing with middleware.
    expect(redirect).not.toHaveBeenCalled()
    RootDashboardPage()
    expect(redirect).toHaveBeenCalledTimes(1)
  })
})
