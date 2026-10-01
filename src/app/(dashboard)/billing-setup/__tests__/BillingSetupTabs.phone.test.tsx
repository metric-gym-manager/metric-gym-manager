import { screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes, apiOk } from '@/test-utils/renderScreen'
import PlanTypesTab from '../PlanTypesTab'
import DiscountsTab from '../DiscountsTab'
import AdmissionFeeTab from '../AdmissionFeeTab'

const plans = [
  {
    plan_type: 'monthly',
    default_amount: 3500,
    is_active: true,
    gym_id: 'g1',
    id: 'p1',
  },
  {
    plan_type: 'annual',
    default_amount: 36000,
    is_active: false,
    gym_id: 'g1',
    id: 'p2',
  },
]

const discounts = [
  {
    id: 'd1',
    discount_name: 'Student Discount',
    discount_percentage: 15,
    is_active: true,
    gym_id: 'g1',
  },
]

const routes = () =>
  mockFetchRoutes({
    '/api/billing-setup/plans': apiOk(plans),
    '/api/billing-setup/discounts': apiOk(discounts),
    '/api/members/enrolment-by-plan': apiOk([
      { planType: 'monthly', activeCount: 12 },
    ]),
    '/api/members/discount-usage': apiOk([
      { discountId: 'd1', memberCount: 4 },
    ]),
    '/api/settings/admission-fee': apiOk({
      admission_fee: 1500,
      admission_fee_enabled: true,
    }),
  })

afterEach(() => jest.clearAllMocks())

/**
 * Radix opens a menu on `pointerdown`, which jsdom does not synthesise, so
 * `fireEvent.click` leaves it closed and the query times out. Enter on the
 * trigger is the keyboard path, it works here, and it is an interaction that
 * has to work anyway. Phase 4's Members suite uses the same opener.
 */
const openMenu = (trigger: HTMLElement) =>
  fireEvent.keyDown(trigger, { key: 'Enter' })

describe('Plan types — phone tier', () => {
  it('renders one row per plan with its price, enrolment and status', async () => {
    routes()
    renderScreen(<PlanTypesTab />, { viewport: 'phone' })

    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)

    const monthly = within(rows[0])
    expect(monthly.getByText('Monthly Plan')).toBeInTheDocument()
    expect(monthly.getByText('Active')).toBeInTheDocument()
    // One text node by design (F10), so the segments are asserted together.
    expect(monthly.getByText('LKR 3500.00 · 12 enrolled')).toBeInTheDocument()

    const annual = within(rows[1])
    expect(annual.getByText('Inactive')).toBeInTheDocument()
    expect(annual.getByText('LKR 36000.00 · 0 enrolled')).toBeInTheDocument()
  })

  /**
   * Three actions is one more than a `ListRow` takes ("one or two dense
   * buttons. Three or more belong in a `DropdownMenu`"), and §25.4 says the
   * same — the desktop's three side-by-side 26 px buttons are what the audit
   * measured. The row must expose one named trigger, not three buttons.
   */
  it('folds the three row actions behind one named menu', async () => {
    routes()
    renderScreen(<PlanTypesTab />, { viewport: 'phone' })
    const rows = await screen.findAllByRole('listitem')

    const trigger = within(rows[0]).getByRole('button', {
      name: 'Actions for Monthly Plan',
    })
    expect(within(rows[0]).queryByRole('button', { name: 'Edit' })).toBeNull()

    openMenu(trigger)
    for (const label of ['Edit', 'Deactivate', 'Delete']) {
      expect(await screen.findByRole('menuitem', { name: label })).toBeVisible()
    }
  })

  it('names the menu action for what it will do to an inactive plan', async () => {
    routes()
    renderScreen(<PlanTypesTab />, { viewport: 'phone' })
    const rows = await screen.findAllByRole('listitem')

    openMenu(
      within(rows[1]).getByRole('button', { name: 'Actions for Annual Plan' })
    )
    expect(
      await screen.findByRole('menuitem', { name: 'Activate' })
    ).toBeVisible()
  })

  /**
   * §8.13: the phone edits in a sheet, the desktop inline. Same inputs, same
   * mutation — so this asserts the inputs are the ones the desktop form has,
   * inside a dialog, and that no inline form opened in the row.
   */
  it('edits in a sheet, carrying the same fields as the desktop form', async () => {
    routes()
    renderScreen(<PlanTypesTab />, { viewport: 'phone' })
    const rows = await screen.findAllByRole('listitem')

    openMenu(
      within(rows[0]).getByRole('button', { name: 'Actions for Monthly Plan' })
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-placement', 'sheet')
    expect(within(dialog).getByText('Edit Monthly Plan')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Default Amount (LKR)')).toHaveValue(
      3500
    )
    expect(
      within(dialog).getByLabelText('Active (available for new members)')
    ).toBeChecked()
  })

  it('has no sheet on the desktop tier — it edits in place', async () => {
    routes()
    renderScreen(<PlanTypesTab />, { viewport: 'desktop' })
    await screen.findByText('Monthly Plan')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Default Amount (LKR)')).toHaveValue(3500)
  })
})

describe('Discounts — phone tier', () => {
  it('renders rows instead of the five-column table', async () => {
    routes()
    renderScreen(<DiscountsTab />, { viewport: 'phone' })

    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(screen.queryByRole('table')).toBeNull()

    const row = within(rows[0])
    expect(row.getByText('Student Discount')).toBeInTheDocument()
    expect(row.getByText('Active')).toBeInTheDocument()
    expect(row.getByText('15% off · 4 in use')).toBeInTheDocument()
    // Two actions is within a row's budget; they stay visible.
    expect(row.getByRole('button', { name: 'Deactivate' })).toBeVisible()
    expect(row.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  it('keeps the table on the desktop tier', async () => {
    routes()
    renderScreen(<DiscountsTab />, { viewport: 'desktop' })
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('adds a discount in a sheet', async () => {
    routes()
    renderScreen(<DiscountsTab />, { viewport: 'phone' })
    await screen.findAllByRole('listitem')

    fireEvent.click(screen.getByRole('button', { name: 'Add Discount' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-placement', 'sheet')
    expect(within(dialog).getByLabelText(/Discount Name/)).toBeInTheDocument()
  })

  /**
   * §15.1: the 44 px belongs to a label that WRAPS the control. `htmlFor`
   * alone is an association, not a hit area — the distinction Phase 4 paid for
   * — and a bare `Checkbox` is 24 px on a phone, under the probe's floor.
   */
  it('wraps the active checkbox in its label', async () => {
    routes()
    renderScreen(<DiscountsTab />, { viewport: 'phone' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Discount' }))

    const box = await screen.findByLabelText('Active (available for selection)')
    expect(box.closest('label')).not.toBeNull()
  })
})

describe('Admission fee', () => {
  it('wraps the enable checkbox in its label, on both tiers', async () => {
    routes()
    renderScreen(<AdmissionFeeTab />, { viewport: 'phone' })

    const box = await screen.findByLabelText(/Enable admission fee/)
    const label = box.closest('label')
    expect(label).not.toBeNull()
    expect(label).toHaveClass('phone:min-h-touch')
    // The description stays with it rather than moving out of the control.
    expect(
      within(label as HTMLElement).getByText(/self-registration form/)
    ).toBeInTheDocument()
  })
})
