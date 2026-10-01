import { screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen, mockFetchRoutes } from '@/test-utils/renderScreen'
import BillingHistoryTable from '../components/BillingHistoryTable'

const payments = [
  {
    id: 'l1',
    date: '2026-09-01',
    orderId: 'MGO-000123',
    order_id: 'MGO-000123',
    paymentId: null,
    payment_id: null,
    status: 'paid' as const,
    amount: '4,900.00',
    currency: 'LKR',
  },
  {
    id: 'l2',
    date: '2026-08-01',
    orderId: null,
    order_id: null,
    paymentId: null,
    payment_id: null,
    status: 'failed' as const,
    amount: null,
    currency: null,
  },
]

const routes = () =>
  mockFetchRoutes({
    '/api/billing/history': {
      success: true,
      data: { payments },
      meta: { page: 1, totalPages: 1, totalCount: payments.length },
    },
  })

afterEach(() => jest.clearAllMocks())

/**
 * §8.17 + §9.4 "Billing history": date, amount and status stay in the row, the
 * order id is disclosed on the meta line. The desktop keeps its four-column
 * `Table` — which lives in an `overflow-x-auto` div, so on a phone it never
 * widened the page, it hid two of the four columns inside a scroller with no
 * visual cue (probe rule 3, the audit's "overflowing tables hid here").
 */
describe('Billing history — phone tier', () => {
  it('renders a row per payment with date, status and amount', async () => {
    routes()
    renderScreen(<BillingHistoryTable />, { viewport: 'phone' })

    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(screen.queryByRole('table')).toBeNull()

    const first = within(rows[0])
    expect(first.getByText('2026-09-01')).toBeInTheDocument()
    expect(first.getByText('paid')).toBeInTheDocument()
    expect(first.getByText('LKR 4,900.00')).toBeInTheDocument()
    expect(first.getByText('MGO-000123')).toBeInTheDocument()
  })

  /**
   * §27 "Partially populated": a missing optional value renders "—", it does
   * not collapse the row or print an empty cell. Both of this row's optional
   * fields are null, which is the real shape of a failed charge.
   */
  it('renders a missing order id and amount as a dash', async () => {
    routes()
    renderScreen(<BillingHistoryTable />, { viewport: 'phone' })

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[1]).getAllByText('—')).toHaveLength(2)
    expect(within(rows[1]).getByText('failed')).toBeInTheDocument()
  })

  it('keeps the table on the desktop tier', async () => {
    routes()
    renderScreen(<BillingHistoryTable />, { viewport: 'desktop' })

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    // The columns the phone row discloses are still columns here.
    expect(screen.getByRole('columnheader', { name: 'Order' })).toBeVisible()
  })
})
