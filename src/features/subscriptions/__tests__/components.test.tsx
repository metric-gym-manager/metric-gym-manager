import { render, screen } from '@testing-library/react';
import CurrentPlanCard from '@/features/subscriptions/components/CurrentPlanCard';
import PastDueBanner from '@/features/subscriptions/components/PastDueBanner';
import QuotaReachedUpsell from '@/features/subscriptions/components/QuotaReachedUpsell';
import ReactivationLimitDialog from '@/features/subscriptions/components/ReactivationLimitDialog';
import {
  SaasTier,
  SaasStatus,
  STARTER_TIER_MEMBER_LIMIT,
  GROWTH_TIER_MEMBER_LIMIT,
  RecurringFailureClass,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '@/features/subscriptions/types';

// QuotaReachedUpsell reads the subscription; default to a Starter gym.
const mockUseSubscription = jest.fn();
jest.mock('@/features/subscriptions/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

function makeSerialized(
  overrides: Partial<SerializedSubscription> = {}
): SerializedSubscription {
  return {
    subscriptionTier: SaasTier.Starter,
    subscription_tier: SaasTier.Starter,
    subscriptionStatus: SaasStatus.Active,
    subscription_status: SaasStatus.Active,
    memberCount: 10,
    member_count: 10,
    memberLimit: STARTER_TIER_MEMBER_LIMIT,
    member_limit: STARTER_TIER_MEMBER_LIMIT,
    currentPeriodEnd: null,
    current_period_end: null,
    graceEndsAt: null,
    grace_ends_at: null,
    pastDueReason: null,
    past_due_reason: null,
    canAddMember: true,
    capabilities: { automatedReminders: false, announcements: false },
    remainingMemberSlots: STARTER_TIER_MEMBER_LIMIT - 10,
    remaining_member_slots: STARTER_TIER_MEMBER_LIMIT - 10,
    isComplimentary: false,
    is_complimentary: false,
    ...overrides,
  };
}

const noop = () => undefined;

beforeEach(() => {
  mockUseSubscription.mockReturnValue({ data: { subscription: makeSerialized() } });
});

describe('CurrentPlanCard (state-to-UI mapping, plan §5.3)', () => {
  it('free below limit: usage meter + Upgrade CTA, no cancel', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized()}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText('Starter Plan')).toBeInTheDocument();
    expect(screen.getByText(`10 / ${STARTER_TIER_MEMBER_LIMIT}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade to growth/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });

  it('free over limit (post-downgrade): explains kept members, Re-subscribe CTA', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionStatus: SaasStatus.Canceled,
          subscription_status: SaasStatus.Canceled,
          memberCount: 500,
          member_count: 500,
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText(/existing members are kept/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-subscribe to growth/i })).toBeInTheDocument();
  });

  it('growth/active: 190 cap meter, renewal date, cancel visible', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Growth,
          subscription_tier: SaasTier.Growth,
          memberCount: 120,
          member_count: 120,
          memberLimit: GROWTH_TIER_MEMBER_LIMIT,
          member_limit: GROWTH_TIER_MEMBER_LIMIT,
          currentPeriodEnd: '2026-08-04',
          current_period_end: '2026-08-04',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText('Growth Plan')).toBeInTheDocument();
    expect(screen.getByText(`120 / ${GROWTH_TIER_MEMBER_LIMIT}`)).toBeInTheDocument();
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel subscription/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
  });

  it('pro/canceled paid-through: "Pro until {date}", re-subscribe, no cancel', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Growth,
          subscription_tier: SaasTier.Growth,
          subscriptionStatus: SaasStatus.Canceled,
          subscription_status: SaasStatus.Canceled,
          memberLimit: null,
          member_limit: null,
          currentPeriodEnd: '2026-08-04',
          current_period_end: '2026-08-04',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText(/growth features continue until/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-subscribe to growth/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });
});

describe('PastDueBanner (C-22 copy branching)', () => {
  const pastDue = (reason: RecurringFailureClass) =>
    makeSerialized({
      subscriptionTier: SaasTier.Growth,
      subscription_tier: SaasTier.Growth,
      subscriptionStatus: SaasStatus.PastDue,
      subscription_status: SaasStatus.PastDue,
      graceEndsAt: '2099-01-08',
      grace_ends_at: '2099-01-08',
      pastDueReason: reason,
      past_due_reason: reason,
    });

  it('retriable: "PayHere will retry" copy', () => {
    render(<PastDueBanner subscription={pastDue(RecurringFailureClass.Retriable)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/payhere will retry/i);
    expect(screen.getByRole('alert')).toHaveTextContent('2099-01-08');
  });

  it('hard: "won’t be retried … re-subscribe" copy', () => {
    render(<PastDueBanner subscription={pastDue(RecurringFailureClass.Hard)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/won’t be retried/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/re-subscribe/i);
  });
});

describe('QuotaReachedUpsell', () => {
  it('Starter at limit: upsells to Growth with the 40/40 copy', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        subscription: makeSerialized({
          memberCount: STARTER_TIER_MEMBER_LIMIT,
          member_count: STARTER_TIER_MEMBER_LIMIT,
        }),
      },
    });
    render(<QuotaReachedUpsell />);
    expect(screen.getByTestId('quota-reached-upsell')).toHaveTextContent(
      `${STARTER_TIER_MEMBER_LIMIT}/${STARTER_TIER_MEMBER_LIMIT}`
    );
    expect(screen.getByRole('link', { name: /upgrade to growth/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });

  it('Growth at limit: upsells to Enterprise (unlimited)', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        subscription: makeSerialized({
          subscriptionTier: SaasTier.Growth,
          subscription_tier: SaasTier.Growth,
          memberCount: GROWTH_TIER_MEMBER_LIMIT,
          member_count: GROWTH_TIER_MEMBER_LIMIT,
          memberLimit: GROWTH_TIER_MEMBER_LIMIT,
          member_limit: GROWTH_TIER_MEMBER_LIMIT,
        }),
      },
    });
    render(<QuotaReachedUpsell />);
    const upsell = screen.getByTestId('quota-reached-upsell');
    expect(upsell).toHaveTextContent(`${GROWTH_TIER_MEMBER_LIMIT}/${GROWTH_TIER_MEMBER_LIMIT}`);
    expect(upsell).toHaveTextContent(/unlimited active members/i);
    expect(screen.getByRole('link', { name: /upgrade to enterprise/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });
});

describe('ReactivationLimitDialog', () => {
  it('renders nothing when closed', () => {
    mockUseSubscription.mockReturnValue({
      data: { subscription: makeSerialized() },
    });
    render(<ReactivationLimitDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText(/active member limit reached/i)).not.toBeInTheDocument();
  });

  it('Starter at limit: explains active-only counting and upsells to Growth', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        subscription: makeSerialized({
          memberCount: STARTER_TIER_MEMBER_LIMIT,
          member_count: STARTER_TIER_MEMBER_LIMIT,
        }),
      },
    });
    render(<ReactivationLimitDialog open onOpenChange={() => {}} />);
    expect(screen.getByText(/active member limit reached/i)).toBeInTheDocument();
    // Communicates that only active members count and nothing was charged
    expect(screen.getByText(/nothing was charged/i)).toBeInTheDocument();
    expect(screen.getByText(/expired, suspended and cancelled members are unlimited/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upgrade to growth/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });

  it('Growth at limit: upsells to Enterprise', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        subscription: makeSerialized({
          subscriptionTier: SaasTier.Growth,
          subscription_tier: SaasTier.Growth,
          memberLimit: GROWTH_TIER_MEMBER_LIMIT,
          member_limit: GROWTH_TIER_MEMBER_LIMIT,
        }),
      },
    });
    render(<ReactivationLimitDialog open onOpenChange={() => {}} />);
    expect(screen.getByRole('link', { name: /upgrade to enterprise/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });
});
