import { render, screen } from '@testing-library/react';
import ProAvatarRing from '../components/ProAvatarRing';
import { SaasTier } from '@/features/subscriptions/config/SubscriptionConfig';

describe('ProAvatarRing', () => {
  it('renders children unwrapped for the Lite tier', () => {
    render(
      <ProAvatarRing tier={SaasTier.Lite}>
        <span data-testid="avatar">GA</span>
      </ProAvatarRing>
    );
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.queryByTestId('pro-avatar-ring')).not.toBeInTheDocument();
  });

  it('renders children unwrapped while the subscription is still loading', () => {
    render(
      <ProAvatarRing tier={undefined}>
        <span data-testid="avatar">GA</span>
      </ProAvatarRing>
    );
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.queryByTestId('pro-avatar-ring')).not.toBeInTheDocument();
  });

  it('wraps the avatar in the animated ring for the Pro tier', () => {
    render(
      <ProAvatarRing tier={SaasTier.Pro}>
        <span data-testid="avatar">GA</span>
      </ProAvatarRing>
    );
    const ring = screen.getByTestId('pro-avatar-ring');
    expect(ring).toBeInTheDocument();
    expect(ring).toHaveAttribute('title', 'Pro subscriber');
    // The child avatar still renders inside the ring
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    // Decorative gradient layer: hidden from AT, animated only when motion is ok
    const gradient = ring.querySelector('[aria-hidden="true"]');
    expect(gradient).not.toBeNull();
    expect(gradient!.className).toContain('motion-safe:animate-');
  });

  it('wraps the avatar in the ring for the Enterprise tier too', () => {
    render(
      <ProAvatarRing tier={SaasTier.Enterprise}>
        <span data-testid="avatar">GA</span>
      </ProAvatarRing>
    );
    const ring = screen.getByTestId('pro-avatar-ring');
    expect(ring).toBeInTheDocument();
    expect(ring).toHaveAttribute('title', 'Enterprise subscriber');
  });
});
