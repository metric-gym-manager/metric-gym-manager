import { render, screen } from '@testing-library/react';
import MemberLimitBar from '../components/MemberLimitBar';
import { SaasTier, LITE_TIER_MEMBER_LIMIT } from '@/core/utils/constants/SubscriptionConfig';

const mockUsePathname = jest.fn<string, []>();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

const mockUseSubscription = jest.fn();
jest.mock('../hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

function subscriptionData(tier: SaasTier, memberCount: number, limit: number | null, remaining: number | null) {
  return {
    data: {
      litePriceLkr: 2990,
      subscription: {
        subscriptionTier: tier,
        memberCount,
        memberLimit: limit,
        remainingMemberSlots: remaining,
      },
    },
  };
}

describe('MemberLimitBar (Lite-only — the one capped tier)', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('shows remaining slots + Upgrade CTA for a Lite gym', () => {
    mockUseSubscription.mockReturnValue(
      subscriptionData(SaasTier.Lite, 93, LITE_TIER_MEMBER_LIMIT, 7)
    );
    render(<MemberLimitBar />);
    const bar = screen.getByTestId('member-limit-bar');
    expect(bar).toHaveTextContent(`7 of ${LITE_TIER_MEMBER_LIMIT} active member slots left on the Lite plan`);
    expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute('href', '/settings/billing');
  });

  it('renders the at-limit state when no slots remain', () => {
    mockUseSubscription.mockReturnValue(
      subscriptionData(SaasTier.Lite, LITE_TIER_MEMBER_LIMIT, LITE_TIER_MEMBER_LIMIT, 0)
    );
    render(<MemberLimitBar />);
    expect(screen.getByTestId('member-limit-bar')).toHaveTextContent(/member limit reached/i);
  });

  it('renders nothing for an unlimited (Pro) gym', () => {
    mockUseSubscription.mockReturnValue(subscriptionData(SaasTier.Pro, 999, null, null));
    render(<MemberLimitBar />);
    expect(screen.queryByTestId('member-limit-bar')).not.toBeInTheDocument();
  });

  it('renders nothing for an unlimited (Enterprise) gym', () => {
    mockUseSubscription.mockReturnValue(subscriptionData(SaasTier.Enterprise, 999, null, null));
    render(<MemberLimitBar />);
    expect(screen.queryByTestId('member-limit-bar')).not.toBeInTheDocument();
  });

  it('renders nothing anywhere under /settings', () => {
    mockUsePathname.mockReturnValue('/settings/billing');
    mockUseSubscription.mockReturnValue(
      subscriptionData(SaasTier.Lite, 93, LITE_TIER_MEMBER_LIMIT, 7)
    );
    render(<MemberLimitBar />);
    expect(screen.queryByTestId('member-limit-bar')).not.toBeInTheDocument();
  });

  it('renders nothing while the subscription is loading', () => {
    mockUseSubscription.mockReturnValue({ data: undefined });
    render(<MemberLimitBar />);
    expect(screen.queryByTestId('member-limit-bar')).not.toBeInTheDocument();
  });
});
