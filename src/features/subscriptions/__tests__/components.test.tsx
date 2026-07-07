import { render, screen } from '@testing-library/react';
import CurrentPlanCard from '@/features/subscriptions/components/CurrentPlanCard';
import PastDueBanner from '@/features/subscriptions/components/PastDueBanner';
import QuotaReachedUpsell from '@/features/subscriptions/components/QuotaReachedUpsell';
import {
  SaasTier,
  SaasStatus,
  STARTER_TIER_MEMBER_LIMIT,
  RecurringFailureClass,
} from '@/core/utils/constants/SubscriptionConfig';
import type { SerializedSubscription } from '@/features/subscriptions/types';

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
    ...overrides,
  };
}

const noop = () => undefined;

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

  it('pro/active: unlimited members, renewal date, cancel visible', () => {
    render(
      <CurrentPlanCard
        subscription={makeSerialized({
          subscriptionTier: SaasTier.Growth,
          subscription_tier: SaasTier.Growth,
          memberLimit: null,
          member_limit: null,
          currentPeriodEnd: '2026-08-04',
          current_period_end: '2026-08-04',
        })}
        onUpgradeClick={noop}
        onCancelClick={noop}
      />
    );
    expect(screen.getByText('Growth Plan')).toBeInTheDocument();
    expect(screen.getByText(/unlimited/)).toBeInTheDocument();
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
  it('renders the limit copy and links to the billing page', () => {
    render(<QuotaReachedUpsell memberCount={STARTER_TIER_MEMBER_LIMIT} />);
    expect(screen.getByTestId('quota-reached-upsell')).toHaveTextContent(
      `${STARTER_TIER_MEMBER_LIMIT}/${STARTER_TIER_MEMBER_LIMIT}`
    );
    expect(screen.getByRole('link', { name: /upgrade to growth/i })).toHaveAttribute(
      'href',
      '/settings/billing'
    );
  });
});
