import { render, screen } from '@testing-library/react';
import CurrentPlanCard from '@/features/subscriptions/components/CurrentPlanCard';
import PastDueBanner from '@/features/subscriptions/components/PastDueBanner';
import TrialBanner from '@/features/subscriptions/components/TrialBanner';
import QuotaReachedUpsell from '@/features/subscriptions/components/QuotaReachedUpsell';
import ReactivationLimitDialog from '@/features/subscriptions/components/ReactivationLimitDialog';
import {
  SaasTier,
  SaasStatus,
  LITE_TIER_MEMBER_LIMIT,
  RecurringFailureClass,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '@/features/subscriptions/types';

// QuotaReachedUpsell reads the subscription; default to a Lite gym.
const mockUseSubscription = jest.fn();
jest.mock('@/features/subscriptions/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

function makeSerialized(
  overrides: Partial<SerializedSubscription> = {}
): SerializedSubscription {
  return {
    subscriptionTier: SaasTier.Lite,
    subscription_tier: SaasTier.Lite,
    subscriptionStatus: SaasStatus.Active,
    subscription_status: SaasStatus.Active,
    memberCount: 10,
    member_count: 10,
    memberLimit: LITE_TIER_MEMBER_LIMIT,
    member_limit: LITE_TIER_MEMBER_LIMIT,
    currentPeriodEnd: null,
    current_period_end: null,
    trialEndsAt: null,
    trial_ends_at: null,
    graceEndsAt: null,
    grace_ends_at: null,
    pastDueReason: null,
    past_due_reason: null,
    canAddMember: true,
    capabilities: { automatedReminders: true, announcements: true, accessControlHardware: false },
    remainingMemberSlots: LITE_TIER_MEMBER_LIMIT - 10,
    remaining_member_slots: LITE_TIER_MEMBER_LIMIT - 10,
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
  it('lite/active: usage meter, renewal date, cancel visible, no subscribe CTA', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          currentPeriodEnd: '2026-08-04',
          current_period_end: '2026-08-04',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText('Lite Plan')).toBeInTheDocument();
    expect(screen.getByText(`10 / ${LITE_TIER_MEMBER_LIMIT}`)).toBeInTheDocument();
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel subscription/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subscribe to/i })).not.toBeInTheDocument();
  });

  it('lite/trialing: trial copy with the trial deadline and a subscribe CTA', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionStatus: SaasStatus.Trialing,
          subscription_status: SaasStatus.Trialing,
          trialEndsAt: '2026-07-20',
          trial_ends_at: '2026-07-20',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText(/free trial/i)).toBeInTheDocument();
    expect(screen.getByText('2026-07-20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe to lite/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });

  it('suspended: "suspended until payment" copy, subscribe CTA, no cancel', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Pro,
          subscription_tier: SaasTier.Pro,
          subscriptionStatus: SaasStatus.Suspended,
          subscription_status: SaasStatus.Suspended,
          memberLimit: null,
          member_limit: null,
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText(/until payment is\s+received/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe to pro/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });

  it('pro/canceled paid-through: features until date, then suspension — re-subscribe CTA', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Pro,
          subscription_tier: SaasTier.Pro,
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
    expect(screen.getByText(/pro features continue until/i)).toBeInTheDocument();
    expect(screen.getByText(/suspended until payment is received/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe to pro/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });

  it('pro/active: no usage meter (unlimited), cancel visible', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Pro,
          subscription_tier: SaasTier.Pro,
          memberCount: 500,
          member_count: 500,
          memberLimit: null,
          member_limit: null,
          currentPeriodEnd: '2026-08-04',
          current_period_end: '2026-08-04',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    expect(screen.getByText(/500\s*— unlimited/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel subscription/i })).toBeInTheDocument();
  });
});

describe('TrialBanner', () => {
  it('renders while trialing with the deadline and a subscribe CTA', () => {
    render(
      <TrialBanner
        subscription={makeSerialized({
          subscriptionStatus: SaasStatus.Trialing,
          subscription_status: SaasStatus.Trialing,
          trialEndsAt: '2099-01-08',
          trial_ends_at: '2099-01-08',
        })}
      />
    );
    const banner = screen.getByTestId('trial-banner');
    expect(banner).toHaveTextContent(/free trial/i);
    expect(banner).toHaveTextContent('2099-01-08');
    expect(screen.getByRole('link', { name: /subscribe/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });

  it('renders nothing when not trialing', () => {
    render(<TrialBanner subscription={makeSerialized()} />);
    expect(screen.queryByTestId('trial-banner')).not.toBeInTheDocument();
  });
});

describe('PastDueBanner (C-22 copy branching)', () => {
  const pastDue = (reason: RecurringFailureClass) =>
    makeSerialized({
      subscriptionTier: SaasTier.Pro,
      subscription_tier: SaasTier.Pro,
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

  it('hard: "won’t be retried … suspended" copy', () => {
    render(<PastDueBanner subscription={pastDue(RecurringFailureClass.Hard)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/won’t be retried/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/suspended/i);
  });
});

describe('QuotaReachedUpsell', () => {
  it('Lite at limit: upsells to Pro with the 100/100 copy', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        subscription: makeSerialized({
          memberCount: LITE_TIER_MEMBER_LIMIT,
          member_count: LITE_TIER_MEMBER_LIMIT,
        }),
      },
    });
    render(<QuotaReachedUpsell />);
    expect(screen.getByTestId('quota-reached-upsell')).toHaveTextContent(
      `${LITE_TIER_MEMBER_LIMIT}/${LITE_TIER_MEMBER_LIMIT}`
    );
    expect(screen.getByTestId('quota-reached-upsell')).toHaveTextContent(
      /unlimited active members/i
    );
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toHaveAttribute(
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

  it('Lite at limit: explains active-only counting and upsells to Pro', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        subscription: makeSerialized({
          memberCount: LITE_TIER_MEMBER_LIMIT,
          member_count: LITE_TIER_MEMBER_LIMIT,
        }),
      },
    });
    render(<ReactivationLimitDialog open onOpenChange={() => {}} />);
    expect(screen.getByText(/active member limit reached/i)).toBeInTheDocument();
    // Communicates that only active members count and nothing was charged
    expect(screen.getByText(/nothing was charged/i)).toBeInTheDocument();
    expect(screen.getByText(/expired, suspended and cancelled members are unlimited/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });
});
