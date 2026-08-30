import type { BadgeProps } from '@/components/ui'
import { getDaysUntilDue } from './getDaysUntilDue'

/**
 * The single mapping from a member's state to how it is displayed.
 *
 * Before this existed, the same four statuses were mapped four different ways:
 * `getStatusVariant` duplicated byte-for-byte in `MemberDetailModal` and
 * `MemberDetailModalMobile`, a `getStatusDotClass` colour-only dot in the
 * members table, and a `memberBadge` in the page client that alone knew about
 * "expires soon". They could disagree, and did.
 *
 * A data map, not a visual primitive — it returns a variant and a label, and
 * the caller renders a `Badge`. Directive §4.4 bans new visual abstractions;
 * this removes three implementations rather than adding a fourth.
 */
export interface MemberStatusIndicator {
  variant: NonNullable<BadgeProps['variant']>
  label: string
}

/** Days before `next_due_date` at which an active member reads as expiring. */
export const EXPIRES_SOON_DAYS = 7

export function memberStatusIndicator(
  status: string,
  nextDueDate?: string | null
): MemberStatusIndicator {
  if (status === 'active') {
    if (nextDueDate) {
      const days = getDaysUntilDue(new Date(nextDueDate))
      // Still flagged active but already past the due date — the nightly job
      // has not caught up yet. Reporting this as a healthy green "Active" is
      // the worst of the options: the front desk would wave the member through.
      if (days < 0) return { variant: 'error', label: 'Overdue' }
      if (days <= EXPIRES_SOON_DAYS) {
        return { variant: 'warning', label: 'Expires soon' }
      }
    }
    return { variant: 'success', label: 'Active' }
  }
  if (status === 'expired') return { variant: 'error', label: 'Expired' }
  if (status === 'suspended') return { variant: 'warning', label: 'Suspended' }
  if (status === 'cancelled') return { variant: 'neutral', label: 'Cancelled' }
  return { variant: 'neutral', label: status }
}
