import { screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import SecurityPage from '../page'

const profile = {
  gym_name: 'Titan Fitness',
  username: 'titan',
  email: 'owner@titan.test',
  email_verified: true,
  phone_number: '+94770001234',
}

afterEach(() => jest.clearAllMocks())

/**
 * §8.14: Security's four dialogs are `sheet`s.
 *
 * Every one is a short credential form — one decision, ≤ 4 controls — which is
 * §11's definition of a sheet, and the audit called these "the squeezed-dialog
 * shape" on a phone: the `center` placement is a desktop geometry baked into
 * the primitive (`top-24`, `max-h-[calc(100vh-96px)]`), so on a 568 px screen
 * a keyboard leaves almost nothing of the form visible.
 *
 * `placement` is entirely `phone:`-scoped inside `Modal`, so the desktop
 * renders each of these exactly as before — which is why the assertion is on
 * the attribute rather than on geometry jsdom cannot compute.
 */
describe('Security — dialog placement', () => {
  it.each([
    ['Username', 0],
    ['Email address', 1],
    ['Phone number', 2],
    ['Password', 3],
  ])('opens the %s dialog as a sheet', async (label) => {
    mockFetchRoutes({ '/api/auth/profile': apiOk(profile) })
    renderScreen(<SecurityPage />, { viewport: 'phone' })
    await screen.findByText('titan')

    const row = screen.getByText(label).closest('div')!.parentElement!
    fireEvent.click(
      within(row).getByRole('button', { name: /Update|Change|Set/ })
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-placement', 'sheet')
  })

  /**
   * The same attribute on the desktop tier: `sheet` is not a tier switch, it
   * is a placement whose every effect is `phone:`-scoped. If this ever reads
   * `center` on one tier and `sheet` on the other, something has started
   * branching on the tier that should not.
   */
  it('carries the same placement on the desktop tier', async () => {
    mockFetchRoutes({ '/api/auth/profile': apiOk(profile) })
    renderScreen(<SecurityPage />, { viewport: 'desktop' })
    await screen.findByText('titan')

    const row = screen.getByText('Username').closest('div')!.parentElement!
    fireEvent.click(within(row).getByRole('button', { name: 'Update' }))

    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'data-placement',
      'sheet'
    )
  })
})
