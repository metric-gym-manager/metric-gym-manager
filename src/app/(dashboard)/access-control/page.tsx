'use client'

/**
 * Door Access — the daily operations page.
 *
 * Setup lives under Settings → Access Control; this is the screen the front
 * desk actually opens. `FeatureGate` renders the upgrade panel for gyms without
 * the Enterprise capability — UX only, since every endpoint underneath enforces
 * the same check through `requireAccessControlGym`.
 */

import { PageHeader } from '@/components/common/composites'
import FeatureGate from '@/features/subscriptions/components/FeatureGate'
import AccessControlDashboard from '@/features/access-control/components/AccessControlDashboard'

export default function AccessControlPage() {
  return (
    <div className="flex max-w-app flex-col gap-4">
      <PageHeader
        title="Door Access"
        description="Who came in, and whether every reader is healthy"
      />

      <FeatureGate
        feature="accessControlHardware"
        featureLabel="Access control"
        description="Connect fingerprint readers so memberships open your doors automatically."
      >
        <AccessControlDashboard />
      </FeatureGate>
    </div>
  )
}
