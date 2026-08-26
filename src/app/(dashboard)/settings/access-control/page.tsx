'use client'

/**
 * Settings → Access Control.
 *
 * The setup half of the feature: the vendor account, and the readers we manage.
 * Day-to-day operation — who came in, is a door online, is one filling up —
 * lives on `/access-control` instead, because those are different jobs done by
 * different people at different times.
 *
 * `FeatureGate` renders the upgrade panel for non-Enterprise gyms. That is UX
 * only; every endpoint behind this page independently enforces the same
 * capability through `requireAccessControlGym`, so a gym cannot reach the
 * hardware by bypassing the screen.
 */

import FeatureGate from '@/features/subscriptions/components/FeatureGate'
import AccessAccountCard from '@/features/access-control/components/AccessAccountCard'
import AccessReadersCard from '@/features/access-control/components/AccessReadersCard'

export default function AccessControlSettingsPage() {
  return (
    <FeatureGate
      feature="accessControlHardware"
      featureLabel="Access control"
      description="Connect fingerprint readers so memberships open your doors automatically."
    >
      <div className="flex flex-col gap-3">
        <AccessAccountCard />
        <AccessReadersCard />
      </div>
    </FeatureGate>
  )
}
