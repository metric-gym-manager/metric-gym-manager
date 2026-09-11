import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen } from '@/test-utils/renderScreen'
import BillingPageClient from '../BillingPageClient'
import {
  SaasStatus,
  SaasTier,
} from '@/features/subscriptions/config/SubscriptionConfig'

/**
 * A composition test. Every child here has its own unit tests; what has never
 * been covered is the screen's job — deciding WHICH of them appear, and with
 * which props, for a given subscription state. Real children would assert the
 * children's behaviour a second time and hide the wiring underneath it.
 */
let params = new URLSearchParams()
jest.mock('next/navigation', () => ({
  useSearchParams: () => params,
}))

const subscriptionQuery = {
  data: undefined as unknown,
  isLoading: false,
  error: null as unknown,
  refetch: jest.fn(),
}
jest.mock('@/features/subscriptions/hooks/useSubscription', () => ({
  useSubscription: () => subscriptionQuery,
}))
jest.mock('@/features/subscriptions/hooks/usePaymentStatusPoll', () => ({
  usePaymentStatusPoll: (enabled: boolean) => ({ enabled }),
}))

jest.mock('@/features/subscriptions/components/CurrentPlanCard', () => ({
  __esModule: true,
  default: () => <div data-testid="plan-card" />,
}))
jest.mock('@/features/subscriptions/components/PricingTable', () => ({
  __esModule: true,
  default: ({ onUpgrade }: { onUpgrade: (t: SaasTier) => void }) => (
    <div data-testid="pricing">
      {['lite', 'pro', 'enterprise'].map((t) => (
        <button
          key={t}
          data-testid={`upgrade-${t}`}
          onClick={() => onUpgrade(t as SaasTier)}
        >
          {t}
        </button>
      ))}
    </div>
  ),
}))
jest.mock('@/features/subscriptions/components/TrialBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="trial-banner" />,
}))
jest.mock('@/features/subscriptions/components/PastDueBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="past-due-banner" />,
}))
jest.mock('@/features/subscriptions/components/ReturnStatusPanel', () => ({
  __esModule: true,
  default: ({ canceled }: { canceled: boolean }) => (
    <div data-testid="return-panel" data-canceled={String(canceled)} />
  ),
}))
jest.mock('@/features/subscriptions/components/BillingHistoryTable', () => ({
  __esModule: true,
  default: () => <div data-testid="history" />,
}))
jest.mock(
  '@/features/subscriptions/components/CancelSubscriptionDialog',
  () => ({
    __esModule: true,
    default: ({ open }: { open: boolean }) => (
      <div data-testid="cancel-dialog" data-open={String(open)} />
    ),
  })
)
jest.mock('@/features/subscriptions/components/UpgradeConfirmDialog', () => ({
  __esModule: true,
  default: ({
    open,
    targetTier,
    priceLkr,
  }: {
    open: boolean
    targetTier: string
    priceLkr: number | null
  }) => (
    <div
      data-testid="upgrade-dialog"
      data-open={String(open)}
      data-targettier={targetTier}
      data-pricelkr={String(priceLkr)}
    />
  ),
}))

const data = (over: Record<string, unknown> = {}) => ({
  subscription: {
    subscriptionTier: SaasTier.Pro,
    subscriptionStatus: SaasStatus.Active,
    ...((over.subscription as object) ?? {}),
  },
  litePriceLkr: 1000,
  proPriceLkr: 2500,
  enterprisePriceLkr: 9000,
  ...over,
})

const setup = (over: Record<string, unknown> = {}) => {
  Object.assign(subscriptionQuery, {
    data: data(over),
    isLoading: false,
    error: null,
  })
  return renderScreen(<BillingPageClient />)
}

beforeEach(() => {
  params = new URLSearchParams()
  jest.clearAllMocks()
})

describe('Settings → Subscription', () => {
  describe('load states', () => {
    it('shows a loading message before the subscription arrives', () => {
      Object.assign(subscriptionQuery, { isLoading: true, data: undefined })
      renderScreen(<BillingPageClient />)
      expect(screen.getByText('Loading subscription…')).toBeInTheDocument()
      expect(screen.queryByTestId('plan-card')).toBeNull()
    })

    it('offers a retry when the subscription cannot be loaded', async () => {
      Object.assign(subscriptionQuery, {
        isLoading: false,
        data: undefined,
        error: new Error('500'),
      })
      renderScreen(<BillingPageClient />)

      expect(
        screen.getByText('Could not load your subscription.')
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      expect(subscriptionQuery.refetch).toHaveBeenCalled()
    })

    it('treats a successful-but-empty response as an error, not as a blank page', () => {
      // `error || !data` — without the second half the screen would destructure
      // undefined and take the route down.
      Object.assign(subscriptionQuery, {
        isLoading: false,
        data: undefined,
        error: null,
      })
      renderScreen(<BillingPageClient />)
      expect(
        screen.getByText('Could not load your subscription.')
      ).toBeInTheDocument()
    })
  })

  describe('status-conditional banners', () => {
    it('shows the trial banner only while trialing', () => {
      setup({ subscription: { subscriptionStatus: SaasStatus.Trialing } })
      expect(screen.getByTestId('trial-banner')).toBeInTheDocument()
      expect(screen.queryByTestId('past-due-banner')).toBeNull()
    })

    it('shows the past-due banner only when past due', () => {
      setup({ subscription: { subscriptionStatus: SaasStatus.PastDue } })
      expect(screen.getByTestId('past-due-banner')).toBeInTheDocument()
      expect(screen.queryByTestId('trial-banner')).toBeNull()
    })

    it('shows neither banner in good standing', () => {
      setup()
      expect(screen.queryByTestId('trial-banner')).toBeNull()
      expect(screen.queryByTestId('past-due-banner')).toBeNull()
    })
  })

  describe('PayHere return flow', () => {
    it('shows no return panel on a plain visit', () => {
      setup()
      expect(screen.queryByTestId('return-panel')).toBeNull()
    })

    it('shows the return panel when PayHere sends an order back', () => {
      params = new URLSearchParams('order=ORD-1')
      setup()
      expect(screen.getByTestId('return-panel')).toHaveAttribute(
        'data-canceled',
        'false'
      )
    })

    it('distinguishes an abandoned checkout from a completed one', () => {
      params = new URLSearchParams('canceled=1')
      setup()
      expect(screen.getByTestId('return-panel')).toHaveAttribute(
        'data-canceled',
        'true'
      )
    })

    it('treats any other value of ?canceled as not canceled', () => {
      // `=== '1'`, not truthiness: `?canceled=0` must not claim the payment
      // was abandoned.
      params = new URLSearchParams('order=ORD-1&canceled=0')
      setup()
      expect(screen.getByTestId('return-panel')).toHaveAttribute(
        'data-canceled',
        'false'
      )
    })
  })

  describe('upgrade dialog', () => {
    it('stays closed until a tier is chosen', () => {
      setup()
      expect(screen.getByTestId('upgrade-dialog')).toHaveAttribute(
        'data-open',
        'false'
      )
    })

    // `priceForTier` is a hand-written switch over three tiers, feeding the
    // amount a gym is about to be charged. A transposed case here bills the
    // wrong price with the correct tier name beside it.
    it.each([
      [SaasTier.Lite, '1000'],
      [SaasTier.Pro, '2500'],
      [SaasTier.Enterprise, '9000'],
    ])(
      'opens the dialog with the %s tier and its own price',
      async (tier, expected) => {
        setup()
        fireEvent.click(screen.getByTestId(`upgrade-${tier}`))

        const dialog = screen.getByTestId('upgrade-dialog')
        await waitFor(() => expect(dialog).toHaveAttribute('data-open', 'true'))
        expect(dialog).toHaveAttribute('data-targettier', tier)
        expect(dialog).toHaveAttribute('data-pricelkr', expected)
      }
    )

    it('passes a null price through rather than rendering "null" as an amount', () => {
      // litePriceLkr is null whenever the billing env is absent.
      setup({ litePriceLkr: null })
      fireEvent.click(screen.getByTestId('upgrade-lite'))
      expect(screen.getByTestId('upgrade-dialog')).toHaveAttribute(
        'data-pricelkr',
        'null'
      )
    })
  })

  it('always renders the plan card, pricing and billing history', () => {
    setup()
    expect(screen.getByTestId('plan-card')).toBeInTheDocument()
    expect(screen.getByTestId('pricing')).toBeInTheDocument()
    expect(screen.getByTestId('history')).toBeInTheDocument()
  })
})
