import { primaryNavigation, settingsNavigation } from '../navigation'

describe('navigation registry', () => {
  it('exposes the expected top-level destinations in order', () => {
    expect(primaryNavigation.map((item) => item.href)).toEqual([
      '/dashboard',
      '/members',
      '/revenue',
      '/payment-collection',
      '/make-announcement',
      '/billing-setup',
      '/settings',
      '/support',
    ])
  })

  it('gives every item a label and an icon', () => {
    for (const item of [...primaryNavigation, ...settingsNavigation]) {
      expect(item.name.length).toBeGreaterThan(0)
      expect(item.icon).toBeDefined()
    }
  })

  it('has no duplicate hrefs in the primary navigation', () => {
    const hrefs = primaryNavigation.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('scopes every settings sub-page under /settings', () => {
    for (const item of settingsNavigation) {
      expect(item.href.startsWith('/settings')).toBe(true)
    }
  })
})
