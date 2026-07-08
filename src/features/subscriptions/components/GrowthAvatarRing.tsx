'use client';

import type { ReactNode } from 'react';
import { SaasTier } from '@/core/utils/constants/SubscriptionConfig';

interface GrowthAvatarRingProps {
  /** Serialized subscription tier; the ring renders only for Growth. */
  tier: SaasTier | string | undefined;
  /** The avatar element (circular) to decorate. */
  children: ReactNode;
}

/**
 * Growth-subscriber avatar ring — the positive-reinforcement marker for paying
 * gyms (plan: Google One-style multi-colored frame around the profile circle).
 *
 * Presentational only: the caller supplies the serialized tier (single source
 * of truth: `useSubscription` / the subscription serializer). Starter gyms and
 * loading states render the avatar untouched, so this component can never
 * block or reflow the header while the subscription query is in flight.
 *
 * The ring stays visible for every Growth state (active, past_due in grace,
 * canceled but paid-through) and disappears only when dunning actually lapses
 * the gym to Starter — mirroring exactly when Growth features stop working.
 *
 * Accessibility: the spinning gradient is decorative (`aria-hidden`) and only
 * animates under `motion-safe`; reduced-motion users get a static ring.
 */
export default function GrowthAvatarRing({ tier, children }: GrowthAvatarRingProps) {
  if (tier !== SaasTier.Growth) {
    return <>{children}</>;
  }

  return (
    <div
      data-testid="growth-avatar-ring"
      title="Growth subscriber"
      className="relative shrink-0 rounded-full"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-[3px] rounded-full motion-safe:animate-[spin_6s_linear_infinite]"
        style={{
          background:
            'conic-gradient(from 0deg, #4285F4, #9B72CB, #D96570, #F2A60C, #34A853, #4285F4)',
        }}
      />
      {/* White gap between the gradient and the avatar, Google One style */}
      <div className="absolute -inset-[1px] rounded-full bg-white" aria-hidden="true" />
      <div className="relative rounded-full">{children}</div>
    </div>
  );
}
