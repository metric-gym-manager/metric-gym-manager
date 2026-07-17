'use client';

import type { ReactNode } from 'react';
import { SaasTier } from '@/features/subscriptions/config/SubscriptionConfig';

interface ProAvatarRingProps {
  /** Serialized subscription tier; the ring renders for Pro and Enterprise. */
  tier: SaasTier | string | undefined;
  /** The avatar element (circular) to decorate. */
  children: ReactNode;
}

/**
 * Pro/Enterprise avatar ring — the positive-reinforcement marker for
 * unlimited-tier gyms (Google One-style multi-colored frame around the
 * profile circle).
 *
 * Presentational only: the caller supplies the serialized tier (single source
 * of truth: `useSubscription` / the subscription serializer). Lite gyms and
 * loading states render the avatar untouched, so this component can never
 * block or reflow the header while the subscription query is in flight.
 *
 * Accessibility: the spinning gradient is decorative (`aria-hidden`) and only
 * animates under `motion-safe`; reduced-motion users get a static ring.
 */
export default function ProAvatarRing({ tier, children }: ProAvatarRingProps) {
  if (tier !== SaasTier.Pro && tier !== SaasTier.Enterprise) {
    return <>{children}</>;
  }

  return (
    <div
      data-testid="pro-avatar-ring"
      title={tier === SaasTier.Enterprise ? 'Enterprise subscriber' : 'Pro subscriber'}
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
