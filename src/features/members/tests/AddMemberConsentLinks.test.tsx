import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import AddMemberModal from '../components/AddMemberModal'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}))

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

jest.mock('@/features/subscriptions/components/QuotaReachedUpsell', () => ({
  __esModule: true,
  default: () => <div data-testid="quota-upsell" />,
}))

const mockUseQuery = useQuery as unknown as jest.Mock
const mockUseMutation = useMutation as unknown as jest.Mock
const mockUseQueryClient = useQueryClient as unknown as jest.Mock

const PLAN_TYPES = [
  {
    id: 'plan-1',
    gym_id: 'gym-1',
    plan_type: 'monthly' as const,
    default_amount: 5000,
    is_active: true,
  },
]

function setup() {
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() })
  mockUseMutation.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    error: null,
  })
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'billing-setup-plan-types') return { data: PLAN_TYPES }
    if (queryKey[0] === 'billing-setup-discounts') return { data: [] }
    if (queryKey[0] === 'billing-setup-admission-fee')
      return { data: { admission_fee: 0, admission_fee_enabled: false } }
    return { data: undefined }
  })

  render(<AddMemberModal open onClose={jest.fn()} />)

  fireEvent.change(screen.getByLabelText(/^Name/i), {
    target: { value: 'Jane Doe' },
  })
  fireEvent.change(screen.getByLabelText(/WhatsApp Number/i), {
    target: { value: '0771234567' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Next: Payment/i }))
}

/**
 * **MO-22 was never a defect, and this suite is what establishes that.**
 *
 * The entry read: the consent `Label` wraps its `Checkbox` (which is what
 * gives the row §15.1's 44 px hit area — `htmlFor` alone is an association,
 * not a hit area, F28), so tapping "privacy policy" would open the policy AND
 * tick the box the policy is the precondition for, in one tap.
 *
 * It does not, and no code of ours prevents it. The HTML spec already does:
 * a label's activation behaviour is defined to do nothing for events targeted
 * at an interactive content descendant, and an `<a href>` is interactive
 * content. Browsers implement it and so does jsdom.
 *
 * How it was settled, after a `stopPropagation` "fix" was written and
 * reverted: the obvious test — click the link, assert the box is unticked —
 * passed WITH the handler and WITHOUT it (CLAUDE.md directive 3), because
 * there was nothing for the handler to prevent. A React `onClick` could not
 * have prevented it in any case: React delegates to the root container, above
 * the label, so a synthetic `stopPropagation` runs after the label would
 * already have acted.
 *
 * Kept rather than deleted so the next reader of MO-22 finds the answer
 * instead of re-writing the no-op.
 */
describe('Add member — consent links', () => {
  beforeEach(() => jest.clearAllMocks())

  /**
   * The discriminator. If a click on ANY descendant toggled the box, the two
   * assertions below would be indistinguishable from a label that simply
   * never forwards. A click on the plain `<span>` text DOES toggle it and a
   * click on the `<a>` does not, which is the HTML spec's rule and not an
   * accident of this markup: "the activation behavior of a label element for
   * events targeted at INTERACTIVE CONTENT DESCENDANTS ... must be to do
   * nothing".
   */
  it('toggles from a tap on the plain text and NOT from a tap on a link', () => {
    setup()
    const consent = screen.getByLabelText(/Member accepts/i)

    fireEvent.click(screen.getByText(/Member accepts Metric Gym OS/i))
    expect(consent).toBeChecked()

    fireEvent.click(screen.getByRole('link', { name: 'privacy policy' }))
    expect(consent).toBeChecked() // unchanged by the link

    fireEvent.click(screen.getByRole('link', { name: 'terms of service' }))
    expect(consent).toBeChecked() // still unchanged
  })

  it('leaves an unticked consent unticked when either policy is opened', () => {
    setup()
    const consent = screen.getByLabelText(/Member accepts/i)
    expect(consent).not.toBeChecked()

    fireEvent.click(screen.getByRole('link', { name: 'privacy policy' }))
    fireEvent.click(screen.getByRole('link', { name: 'terms of service' }))

    expect(consent).not.toBeChecked()
  })

  it('opens both policies in a new tab, with the referrer withheld', () => {
    setup()

    for (const [name, href] of [
      ['privacy policy', '/privacy'],
      ['terms of service', '/terms'],
    ]) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
