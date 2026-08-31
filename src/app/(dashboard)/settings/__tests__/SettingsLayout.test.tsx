import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import SettingsLayout from '../layout'

let pathname = '/settings/gym'
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

const renderAt = (path: string) => {
  pathname = path
  return render(
    <SettingsLayout>
      <div data-testid="section-content">section</div>
    </SettingsLayout>
  )
}

const item = (name: string) => screen.getByRole('link', { name })

describe('SettingsLayout sub-navigation', () => {
  it('lists every settings section', () => {
    renderAt('/settings/gym')
    for (const name of [
      'Gym Information',
      'Registration',
      'Rules & Terms',
      'Security',
      'Access Control',
      'Subscription',
    ]) {
      expect(item(name)).toBeInTheDocument()
    }
  })

  it('marks the current section, and only that one', () => {
    renderAt('/settings/policies')
    expect(item('Rules & Terms')).toHaveAttribute('aria-current', 'page')
    expect(item('Gym Information')).not.toHaveAttribute('aria-current')
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1)
  })

  it('keeps a nested route inside its section', () => {
    renderAt('/settings/access-control/devices/abc')
    expect(item('Access Control')).toHaveAttribute('aria-current', 'page')
  })

  /**
   * Ruling V4 of the visual sign-off.
   *
   * This menu renders inside the sidebar's own "Settings" entry, which is
   * filled `surface-selected`. Filling the current item here too put two
   * stacked indigo fills on screen, which §5.14 warns reads as "a large
   * colourful pill" rather than a system state. Fill is reserved for
   * persistent selection (sidebar, table rows); local position within a page
   * is marked with the 2px ink rule `Tabs` already uses.
   *
   * The token had been re-tuned twice on contrast arithmetic before this, so
   * the constraint is pinned here rather than left to the next eye.
   */
  it('marks the current section with a rule, not a filled surface', () => {
    renderAt('/settings/gym')
    const current = item('Gym Information')

    expect(current.className).not.toContain('bg-surface-selected')
    expect(current.className).toContain('border-ink')
  })

  /**
   * Every item carries the border so the active one does not shift its text
   * two pixels sideways when the section changes.
   */
  it('reserves the rule on inactive items so nothing shifts', () => {
    renderAt('/settings/gym')
    expect(item('Security').className).toContain('border-transparent')
    expect(item('Security').className).toContain('border-l-2')
    expect(item('Gym Information').className).toContain('border-l-2')
  })

  it('shows the menu and hides the content at the settings root', () => {
    const { container } = renderAt('/settings')
    // Master/detail: on a phone the root is the menu, a sub-page is the
    // content. The classes are the whole mechanism, so they are the assertion.
    const content = screen.getByTestId('section-content').parentElement!
    expect(content.className).toContain('max-tablet:hidden')
    expect(
      within(container).getByRole('heading', { name: 'Settings' })
    ).toBeInTheDocument()
  })

  it('offers a back link only on a sub-page', () => {
    const { unmount } = renderAt('/settings/gym')
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    unmount()

    renderAt('/settings')
    expect(
      screen.queryByRole('link', { name: 'Settings' })
    ).not.toBeInTheDocument()
  })
})
