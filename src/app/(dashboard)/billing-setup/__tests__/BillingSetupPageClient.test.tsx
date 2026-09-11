import { screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen } from '@/test-utils/renderScreen'
import BillingSetupPageClient from '../BillingSetupPageClient'

// The three tabs are code-split and each opens its own queries. This screen's
// own job is the mobile menu / desktop tabs switch, so stub them.
jest.mock('../PlanTypesTab', () => ({
  __esModule: true,
  default: () => <div data-testid="tab-plans" />,
}))
jest.mock('../DiscountsTab', () => ({
  __esModule: true,
  default: () => <div data-testid="tab-discounts" />,
}))
jest.mock('../AdmissionFeeTab', () => ({
  __esModule: true,
  default: () => <div data-testid="tab-admission-fee" />,
}))

/**
 * Both breakpoint trees are in the DOM at once — `tablet:hidden` and
 * `hidden tablet:block` are CSS, and jsdom applies no stylesheet. Every query
 * here is therefore scoped to one tree; an unscoped `getByText` would match
 * the desktop copy and pass no matter what the mobile menu did.
 */
const mobile = () =>
  within(document.querySelector('.tablet\\:hidden') as HTMLElement)
const desktop = () =>
  within(document.querySelector('.hidden.tablet\\:block') as HTMLElement)

describe('Membership Setup', () => {
  it('shows the page header and the three sections on the mobile menu', () => {
    renderScreen(<BillingSetupPageClient />)

    expect(
      screen.getByRole('heading', { name: 'Membership Setup' })
    ).toBeInTheDocument()
    for (const label of ['Plan types', 'Discounts', 'Admission fee']) {
      expect(mobile().getByText(label)).toBeInTheDocument()
    }
    expect(
      mobile().getByText('Manage membership plan types and pricing')
    ).toBeInTheDocument()
  })

  it('offers all three tabs on desktop', () => {
    renderScreen(<BillingSetupPageClient />)
    for (const label of ['Plan types', 'Discounts', 'Admission fee']) {
      expect(desktop().getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('opens a section from the mobile menu and replaces the menu with it', async () => {
    renderScreen(<BillingSetupPageClient />)
    fireEvent.click(mobile().getByText('Discounts'))

    // `findBy`, not `getBy`: the tabs are `next/dynamic` with ssr:false, so the
    // skeleton renders first and the component only appears once the chunk
    // resolves. With `getBy` these passed or failed depending on whether an
    // earlier test in the file had already warmed the module cache.
    expect(await mobile().findByTestId('tab-discounts')).toBeInTheDocument()
    // The menu is gone, not merely scrolled past.
    expect(mobile().queryByText('Admission fee')).toBeNull()
  })

  it('swaps the page header for a back control inside a section', () => {
    renderScreen(<BillingSetupPageClient />)
    expect(
      screen.getByRole('heading', { name: 'Membership Setup' })
    ).toBeVisible()

    fireEvent.click(mobile().getByText('Plan types'))

    expect(
      screen.queryByRole('heading', { name: 'Membership Setup' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Membership Setup' })
    ).toBeInTheDocument()
  })

  it('returns to the menu from the back control', () => {
    renderScreen(<BillingSetupPageClient />)
    fireEvent.click(mobile().getByText('Plan types'))
    fireEvent.click(screen.getByRole('button', { name: 'Membership Setup' }))

    expect(mobile().getByText('Discounts')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Membership Setup' })
    ).toBeInTheDocument()
  })

  it.each(['Plan types', 'Discounts', 'Admission fee'])(
    'routes the mobile "%s" row to its own section, not always the first',
    async (label) => {
      const expected = {
        'Plan types': 'tab-plans',
        Discounts: 'tab-discounts',
        'Admission fee': 'tab-admission-fee',
      }[label]!

      renderScreen(<BillingSetupPageClient />)
      fireEvent.click(mobile().getByText(label))
      expect(await mobile().findByTestId(expected)).toBeInTheDocument()
    }
  )

  it('leaves the desktop tabs on Plan types regardless of the mobile section', () => {
    // The two trees keep independent state; opening Discounts on the phone
    // must not move the desktop tab out from under a wider viewport.
    renderScreen(<BillingSetupPageClient />)
    fireEvent.click(mobile().getByText('Discounts'))

    expect(desktop().getByRole('tab', { name: 'Plan types' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })
})
