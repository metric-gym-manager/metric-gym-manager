import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

/**
 * Wire the three `useQuery` calls the modal makes (plan types, discounts,
 * admission fee) by query key, so each test only has to describe the gym's
 * admission-fee configuration.
 */
function setup(admissionFee: {
  admission_fee: number
  admission_fee_enabled: boolean
}) {
  const mutate = jest.fn()
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() })
  mockUseMutation.mockReturnValue({ mutate, isPending: false, error: null })
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'billing-setup-plan-types') return { data: PLAN_TYPES }
    if (queryKey[0] === 'billing-setup-discounts') return { data: [] }
    if (queryKey[0] === 'billing-setup-admission-fee')
      return { data: admissionFee }
    return { data: undefined }
  })

  render(<AddMemberModal open onClose={jest.fn()} />)
  return { mutate }
}

/** Fill the required step-1 fields and advance to the payment summary. */
function goToPaymentStep() {
  fireEvent.change(screen.getByLabelText(/^Name/i), {
    target: { value: 'Jane Doe' },
  })
  fireEvent.change(screen.getByLabelText(/WhatsApp Number/i), {
    target: { value: '0771234567' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Next: Payment/i }))
}

/** Tick both required consents on step 2 and submit. */
function submitForm() {
  fireEvent.click(screen.getByLabelText(/Member accepts/i))
  fireEvent.click(screen.getByLabelText(/agrees to the gym/i))
  fireEvent.click(screen.getByRole('button', { name: /Create Member/i }))
}

describe('AddMemberModal — admission fee', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('offers the admission fee checkbox, ticked, when the gym charges one', () => {
    setup({ admission_fee: 1500, admission_fee_enabled: true })

    const checkbox = screen.getByLabelText(/Charge one-time admission fee/i)
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toBeChecked()
    expect(
      screen.getByText(/Charge one-time admission fee \(Rs\. 1,500\)/i)
    ).toBeInTheDocument()
  })

  it('hides the checkbox when the gym has the admission fee disabled', () => {
    setup({ admission_fee: 1500, admission_fee_enabled: false })

    expect(
      screen.queryByLabelText(/Charge one-time admission fee/i)
    ).not.toBeInTheDocument()
  })

  it('hides the checkbox when the gym has no admission fee configured', () => {
    setup({ admission_fee: 0, admission_fee_enabled: true })

    expect(
      screen.queryByLabelText(/Charge one-time admission fee/i)
    ).not.toBeInTheDocument()
  })

  it('shows the combined plan + admission fee total on step 2', () => {
    setup({ admission_fee: 1500, admission_fee_enabled: true })
    goToPaymentStep()

    expect(screen.getByText('Admission Fee (one-time):')).toBeInTheDocument()
    expect(screen.getByText('Rs. 1500.00')).toBeInTheDocument()
    // 5000 plan + 1500 admission
    expect(screen.getByText('Rs. 6500.00')).toBeInTheDocument()
  })

  it('drops the admission fee from the total when the checkbox is unticked', () => {
    setup({ admission_fee: 1500, admission_fee_enabled: true })

    fireEvent.click(screen.getByLabelText(/Charge one-time admission fee/i))
    goToPaymentStep()

    expect(
      screen.queryByText('Admission Fee (one-time):')
    ).not.toBeInTheDocument()
    // Plan amount only, listed once as the line item and once as the total
    expect(screen.getAllByText('Rs. 5000.00')).toHaveLength(2)
  })

  it('submits the combined plan + admission fee as the payment amount', async () => {
    const { mutate } = setup({
      admission_fee: 1500,
      admission_fee_enabled: true,
    })
    goToPaymentStep()
    submitForm()

    await waitFor(() => expect(mutate).toHaveBeenCalled())
    expect(mutate.mock.calls[0][0]).toMatchObject({
      planAmount: 5000,
      paymentAmount: 6500,
    })
  })

  it('submits the plan amount alone when the admission fee is waived', async () => {
    const { mutate } = setup({
      admission_fee: 1500,
      admission_fee_enabled: true,
    })
    fireEvent.click(screen.getByLabelText(/Charge one-time admission fee/i))
    goToPaymentStep()
    submitForm()

    await waitFor(() => expect(mutate).toHaveBeenCalled())
    expect(mutate.mock.calls[0][0]).toMatchObject({
      planAmount: 5000,
      paymentAmount: 5000,
    })
  })

  it('shows the plan amount alone as the total when no admission fee applies', () => {
    setup({ admission_fee: 0, admission_fee_enabled: false })
    goToPaymentStep()

    expect(
      screen.queryByText('Admission Fee (one-time):')
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('Rs. 5000.00')).toHaveLength(2)
  })
})
