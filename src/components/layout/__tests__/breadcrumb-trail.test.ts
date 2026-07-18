import { buildBreadcrumbTrail } from '../breadcrumb-trail'

describe('buildBreadcrumbTrail', () => {
  it('returns an empty trail for the root path', () => {
    expect(buildBreadcrumbTrail('/')).toEqual([])
  })

  it('resolves a top-level route label from the registry', () => {
    expect(buildBreadcrumbTrail('/members')).toEqual([
      { href: '/members', label: 'Members', isLast: true },
    ])
  })

  it('builds a nested settings trail with the parent labelled "Settings"', () => {
    const trail = buildBreadcrumbTrail('/settings/billing')
    expect(trail.map((c) => c.href)).toEqual(['/settings', '/settings/billing'])
    // Parent resolves to "Settings" (not the "General" sub-page label).
    expect(trail.map((c) => c.label)).toEqual(['Settings', 'Billing'])
    expect(trail[trail.length - 1].isLast).toBe(true)
    expect(trail[0].isLast).toBe(false)
  })

  it('title-cases unknown segments', () => {
    expect(buildBreadcrumbTrail('/foo-bar')).toEqual([
      { href: '/foo-bar', label: 'Foo Bar', isLast: true },
    ])
  })
})
