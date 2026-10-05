import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { ComponentType, ReactNode } from 'react'
import HomePage from '../page'
import MarketingLayout from '../(marketing)/layout'
import HubPage from '../(marketing)/gym-management-software-sri-lanka/page'
import PricingPage from '../(marketing)/pricing/page'
import ChooseArticle from '../(marketing)/resources/choosing-gym-management-software-sri-lanka/page'
import PrivacyPolicyPage from '../privacy/page'
import TermsPage from '../terms/page'
import { LOG_IN_PATH, SIGN_UP_PATH } from '@/features/marketing'

/**
 * Public pages must not download the signed-in app's code (SEO-060). The app's
 * providers live in the sign-in and app layouts now, but a <Link> prefetches
 * the route it points at, and /login and /register carry those providers:
 * on a production build the homepage still fetched 77 KB of them through its
 * "Log in" and "Start free trial" links. Every public link to a sign-in route
 * therefore opts out of prefetching; every other link keeps Next's default.
 *
 * `next/link` is replaced so the prop is visible: jsdom renders a plain <a>
 * either way, and prefetching only happens in a production browser.
 */
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: {
    href: string | { pathname: string }
    prefetch?: boolean | null | 'auto'
    children: ReactNode
  }) => (
    <a
      href={typeof href === 'string' ? href : href.pathname}
      data-prefetch={prefetch === false ? 'off' : 'default'}
      {...rest}
    >
      {children}
    </a>
  ),
}))

const SIGN_IN_ROUTES = new Set<string>([LOG_IN_PATH, SIGN_UP_PATH])

function inShell(Page: ComponentType): ComponentType {
  function InMarketingShell() {
    return (
      <MarketingLayout>
        <Page />
      </MarketingLayout>
    )
  }
  return InMarketingShell
}

const SURFACES: [string, ComponentType][] = [
  ['/', HomePage],
  ['/gym-management-software-sri-lanka', inShell(HubPage)],
  ['/pricing', inShell(PricingPage)],
  [
    '/resources/choosing-gym-management-software-sri-lanka',
    inShell(ChooseArticle),
  ],
  ['/privacy', PrivacyPolicyPage],
  ['/terms', TermsPage],
]

afterEach(cleanup)

describe('links from public pages to sign-in routes', () => {
  it.each(SURFACES)(
    '%s does not prefetch /login or /register',
    (_path, Page) => {
      const { container } = render(<Page />)
      const anchors = [...container.querySelectorAll('a[data-prefetch]')]
      const signIn = anchors.filter((a) =>
        SIGN_IN_ROUTES.has(a.getAttribute('href') ?? '')
      )
      expect(signIn.length).toBeGreaterThan(0)
      for (const a of signIn) {
        expect(
          `${a.getAttribute('href')} ${a.getAttribute('data-prefetch')}`
        ).toBe(`${a.getAttribute('href')} off`)
      }
    }
  )

  it('leaves prefetching on for links between public pages', () => {
    const { container } = render(<HomePage />)
    const others = [...container.querySelectorAll('a[data-prefetch]')].filter(
      (a) => !SIGN_IN_ROUTES.has(a.getAttribute('href') ?? '')
    )
    expect(others.length).toBeGreaterThan(0)
    for (const a of others)
      expect(a).toHaveAttribute('data-prefetch', 'default')
  })
})
