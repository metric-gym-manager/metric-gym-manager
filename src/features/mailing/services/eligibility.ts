import { SaasStatus } from '@/features/subscriptions/config/SubscriptionConfig'
import { MailingAudience } from '../config/MailingConfig'

/** Subscriptions that count as current for product and security updates. */
const CURRENT: readonly string[] = [
  SaasStatus.Trialing,
  SaasStatus.Active,
  SaasStatus.PastDue,
]

/**
 * Which audiences a gym belongs to (owner decision, 2026-10-06): every gym
 * gets marketing until it opts out; product and security updates go only to
 * a current subscription. A cancelled or suspended gym — or a status this
 * code does not know — gets marketing only.
 *
 * @param subscriptionStatus - `gyms.subscription_status`
 * @returns The gym's audiences, Marketing first
 */
export function audiencesForGym(subscriptionStatus: string): MailingAudience[] {
  return CURRENT.includes(subscriptionStatus)
    ? [MailingAudience.Marketing, MailingAudience.ProductUpdates]
    : [MailingAudience.Marketing]
}
