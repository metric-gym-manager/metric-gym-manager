import { render, screen } from '@testing-library/react';
import GrowthAvatarRing from '../components/GrowthAvatarRing';
import { SaasTier } from '@/core/utils/constants/SubscriptionConfig';

describe('GrowthAvatarRing', () => {
  it('renders children unwrapped for the Starter tier', () => {
    render(
      <GrowthAvatarRing tier={SaasTier.Starter}>
        <span data-testid="avatar">GA</span>
      </GrowthAvatarRing>
    );
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.queryByTestId('growth-avatar-ring')).not.toBeInTheDocument();
  });

  it('renders children unwrapped while the subscription is still loading', () => {
    render(
      <GrowthAvatarRing tier={undefined}>
        <span data-testid="avatar">GA</span>
      </GrowthAvatarRing>
    );
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.queryByTestId('growth-avatar-ring')).not.toBeInTheDocument();
  });

  it('wraps the avatar in the animated ring for the Growth tier', () => {
    render(
      <GrowthAvatarRing tier={SaasTier.Growth}>
        <span data-testid="avatar">GA</span>
      </GrowthAvatarRing>
    );
    const ring = screen.getByTestId('growth-avatar-ring');
    expect(ring).toBeInTheDocument();
    expect(ring).toHaveAttribute('title', 'Growth subscriber');
    // The child avatar still renders inside the ring
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    // Decorative gradient layer: hidden from AT, animated only when motion is ok
    const gradient = ring.querySelector('[aria-hidden="true"]');
    expect(gradient).not.toBeNull();
    expect(gradient!.className).toContain('motion-safe:animate-');
  });
});
