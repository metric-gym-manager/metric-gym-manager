/**
 * @jest-environment node
 */
import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig'
import { MailingAudience } from '../config/MailingConfig'
import { audiencesForGym } from '../services/eligibility'

/**
 * Owner decision, 2026-10-06: cancelled and suspended gyms receive marketing
 * only, until they opt out. Product and security updates go to current
 * subscriptions. Typed over SaasStatus, so a new status fails here until it is
 * placed on one side.
 */
const EXPECTED: Record<SaasStatus, MailingAudience[]> = {
  [SaasStatus.Trialing]: [
    MailingAudience.Marketing,
    MailingAudience.ProductUpdates,
  ],
  [SaasStatus.Active]: [
    MailingAudience.Marketing,
    MailingAudience.ProductUpdates,
  ],
  [SaasStatus.PastDue]: [
    MailingAudience.Marketing,
    MailingAudience.ProductUpdates,
  ],
  [SaasStatus.Suspended]: [MailingAudience.Marketing],
  [SaasStatus.Canceled]: [MailingAudience.Marketing],
}

describe('audiencesForGym', () => {
  it.each(Object.values(SaasStatus))('places a %s gym correctly', (status) => {
    expect(audiencesForGym(status)).toEqual(EXPECTED[status])
  })

  it('gives an unknown status marketing only, never updates', () => {
    expect(audiencesForGym('frozen')).toEqual([MailingAudience.Marketing])
  })
})
