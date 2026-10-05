import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderScreen } from '@/test-utils/renderScreen'
import { formatDate } from '@/utils/date/date'
import CancelSubscriptionDialog from '../components/CancelSubscriptionDialog'
import { SaasStatus, SaasTier } from '../config/SubscriptionConfig'
import type { SerializedSubscription } from '../types'

/**
 * The cancel dialog names the day the paid features end. It printed the raw
 * `2026-08-04`; every other screen prints the product format (`04 Aug 2026`).
 */
const subscription = {
  subscriptionTier: SaasTier.Pro,
  subscription_tier: SaasTier.Pro,
  subscriptionStatus: SaasStatus.Active,
  subscription_status: SaasStatus.Active,
  currentPeriodEnd: '2026-08-04',
  current_period_end: '2026-08-04',
} as SerializedSubscription

describe('CancelSubscriptionDialog', () => {
  it('says when the paid features end in the product date format', () => {
    renderScreen(
      <CancelSubscriptionDialog
        open
        onClose={jest.fn()}
        subscription={subscription}
      />
    )

    expect(screen.getByText(formatDate('2026-08-04'))).toBeInTheDocument()
    expect(screen.queryByText('2026-08-04')).toBeNull()
  })
})
