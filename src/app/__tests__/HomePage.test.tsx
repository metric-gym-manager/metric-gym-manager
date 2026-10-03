import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import {
  FEATURE_PATHS,
  HOME_PATH,
  HUB_PATH,
  PRICING_PATH,
  PRICING_TIERS,
  buildPageMetadata,
  formatLkr,
} from '@/features/marketing'
import HomePage, { metadata } from '../page'

/**
 * The homepage is the one page every visitor and every crawler reaches. These
 * pin the SEO and accuracy fixes of 2026-10-01 (docs/seo/SEO_TASKS.json
 * SEO-001, SEO-021, SEO-023): what the heading says, where the links go, and
 * the claims the codebase cannot support staying gone.
 */
describe('Homepage', () => {
  it('exports the registered title, description and canonical', () => {
    expect(metadata).toEqual(buildPageMetadata(HOME_PATH))
  })

  it('has one <h1> that says what the product is and where — plus the brand line', () => {
    const { container } = render(<HomePage />)
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    const text = h1s[0].textContent ?? ''
    expect(text).toMatch(/gym management software/i)
    expect(text).toMatch(/Sri Lanka/)
    expect(text).toMatch(/The operating system for serious gyms\./)
  })

  it('links the hub, pricing and every feature page with real URLs', () => {
    const { container } = render(<HomePage />)
    const hrefs = new Set(
      [...container.querySelectorAll('a[href]')].map((a) =>
        a.getAttribute('href')
      )
    )
    for (const path of [
      HUB_PATH,
      PRICING_PATH,
      ...Object.values(FEATURE_PATHS),
      '/contact',
      '/about',
    ]) {
      expect([path, hrefs.has(path)]).toEqual([path, true])
    }
    // The old navigation was hash anchors, with "Resources" pointing at #platform.
    expect(hrefs.has('#platform')).toBe(false)
  })

  it('shows the product’s tier names and prices from the pricing config', () => {
    render(<HomePage />)
    for (const tier of PRICING_TIERS) {
      expect(
        screen.getByRole('heading', { level: 3, name: tier.name })
      ).toBeInTheDocument()
      expect(
        screen.getAllByText(formatLkr(tier.monthlyPriceLkr)).length
      ).toBeGreaterThan(0)
    }
    expect(screen.queryByText(/^Starter$|^Growth$/)).toBeNull()
  })

  /**
   * Each of these was on the homepage and is contradicted by the codebase:
   * no Hikvision provider exists (access-control-integration.md: "a future
   * ZKTeco/Hikvision provider"), enrolment is fingerprint only, no WhatsApp
   * sender exists, there is no check-in feature, and Enterprise never enters
   * the trial flow (SubscriptionConfig.ts).
   */
  it.each([
    /hikvision/i,
    /rfid/i,
    /facial recognition/i,
    /whatsapp/i,
    /check-in/i,
    /trial on every tier/i,
    /−95%|-95%/,
    /automated fee collection/i,
  ])('makes no claim matching %s', (pattern) => {
    const { container } = render(<HomePage />)
    expect(container.textContent ?? '').not.toMatch(pattern)
  })

  it('emits Organization, WebSite and SoftwareApplication structured data', () => {
    const { container } = render(<HomePage />)
    const script = container.querySelector('script[type="application/ld+json"]')
    const types = JSON.parse(script?.textContent ?? '{}')['@graph'].map(
      (n: { '@type': string }) => n['@type']
    )
    expect(types).toEqual(
      expect.arrayContaining([
        'Organization',
        'WebSite',
        'WebPage',
        'SoftwareApplication',
      ])
    )
  })
})
