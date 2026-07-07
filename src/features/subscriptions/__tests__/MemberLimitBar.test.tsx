import { render, screen } from '@testing-library/react';
import MemberLimitBar from '../components/MemberLimitBar';
import {
  SaasTier,
  STARTER_TIER_MEMBER_LIMIT,
  GROWTH_TIER_MEMBER_LIMIT,
} from '@/core/utils/constants/SubscriptionConfig';

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
      proPriceLkr: 4900,
      subscription: {
        subscriptionTier: tier,
        memberCount,
        memberLimit: limit,
        remainingMemberSlots: remaining,
      },
    },
  };
}

describe('MemberLimitBar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('shows remaining slots + Upgrade CTA for a Starter gym', () => {
    mockUseSubscription.mockReturnValue(
      subscriptionData(SaasTier.Starter, 33, STARTER_TIER_MEMBER_LIMIT, 7)
    );
    render(<MemberLimitBar />);
    const bar = screen.getByTestId('member-limit-bar');
    expect(bar).toHaveTextContent(`7 of ${STARTER_TIER_MEMBER_LIMIT} member slots left on the Starter plan`);
    expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute('href', '/settings/billing');
  });

  it('shows Growth (190) usage too', () => {
    mockUseSubscription.mockReturnValue(
      subscriptionData(SaasTier.Growth, 180, GROWTH_TIER_MEMBER_LIMIT, 10)
    );
    render(<MemberLimitBar />);
    expect(screen.getByTestId('member-limit-bar')).toHaveTextContent(
      `10 of ${GROWTH_TIER_MEMBER_LIMIT} member slots left on the Growth plan`
    );
  });

  it('renders the at-limit state when no slots remain', () => {
    mockUseSubscription.mockReturnValue(
      subscriptionData(SaasTier.Growth, GROWTH_TIER_MEMBER_LIMIT, GROWTH_TIER_MEMBER_LIMIT, 0)
    );
    render(<MemberLimitBar />);
    expect(screen.getByTestId('member-limit-bar')).toHaveTextContent(/member limit reached/i);
  });

  it('renders nothing for an unlimited (Enterprise) gym', () => {
    mockUseSubscription.mockReturnValue(subscriptionData(SaasTier.Enterprise, 999, null, null));
    render(<MemberLimitBar />);
    expect(screen.queryByTestId('member-limit-bar')).not.toBeInTheDocument();
  });

  it('renders nothing anywhere under /settings', () => {
    mockUsePathname.mockReturnValue('/settings/billing');
    mockUseSubscription.mockReturnValue(
      subscriptionData(SaasTier.Starter, 33, STARTER_TIER_MEMBER_LIMIT, 7)
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
