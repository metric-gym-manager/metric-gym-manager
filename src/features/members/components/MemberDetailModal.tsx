'use client'

import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Edit } from 'lucide-react'
import {
  Modal,
  Button,
  Badge,
  type BadgeProps,
  Input,
  ListRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Label,
} from '@/components/ui'
// Deep import, NOT the `@/features/sms` barrel. The barrel re-exports
// `sms.service`, which imports `@/lib/supabase/server` and therefore
// `next/headers` — pulling server-only code into the client bundle and failing
// the build with "Ecmascript file had an error". Same trap rule 2.15 records
// for the auth barrel, in a different feature.
import { MemberSmsHistory } from '@/features/sms/components/MemberSmsHistory'
// Deep import for the same reason as above: a feature barrel may re-export
// server-only services. PaymentCalculator is a pure static class.
import { PaymentCalculator } from '@/features/payments/domain/PaymentCalculator'
import MarkPaidDialog from '@/features/payments/components/MarkPaidDialog'
import ReactivationDialog, {
  type ReactivationConfirm,
} from '@/features/payments/components/ReactivationDialog'
import ReactivationLimitDialog from '@/features/subscriptions/components/ReactivationLimitDialog'
import MemberPhotoSection from './MemberPhotoSection'
import { useViewportTier } from '@/hooks/useViewportTier'
import type { MemberWithDiscount, Payment } from '@/features/members/types'
import { parseApiError } from '@/utils/api-error'
import { formatMemberNumber } from '@/features/members/utils/formatMemberNumber'

interface MemberDetailModalProps {
  open: boolean
  onClose: () => void
  member: MemberWithDiscount | null
  payments?: Payment[]
  onEditClick: () => void
  /** Optional door-access panel, injected by the caller. See the responsive wrapper. */
  accessSlot?: ReactNode
}

export default function MemberDetailModal({
  open,
  onClose,
  member,
  payments = [],
  accessSlot,
  onEditClick,
}: MemberDetailModalProps) {
  const queryClient = useQueryClient()

  /**
   * Member detail is a SCREEN on a phone and a dialog on a desktop (plan §10,
   * §3.2). The tier picks which, and nothing else: every visual consequence of
   * `fullscreen` is already `phone:`-scoped inside `Modal`, so this decides
   * the overlay's *kind* — leading Back instead of a trailing ×, focus on the
   * title, and the hardware Back button — not its size.
   *
   * The sub-dialogs stay dialogs on both tiers. A confirmation is a moment,
   * not a place, and giving one the whole screen (and the Back button with it)
   * would make cancelling a delete feel like leaving the member.
   */
  const tier = useViewportTier()
  const detailPlacement = tier === 'phone' ? 'fullscreen' : 'center'

  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [isMarkingRegularPaid, setIsMarkingRegularPaid] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [showActivateDialog, setShowActivateDialog] = useState(false)
  // Opened when an into-active transition (reactivate / pay-to-reactivate) is
  // rejected by the active-member quota (403 MEMBER_LIMIT_REACHED).
  const [showReactivationLimit, setShowReactivationLimit] = useState(false)
  const [activateNewDueDate, setActivateNewDueDate] = useState<string>('')

  // Suspend member mutation
  const suspendMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/members/${memberId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to suspend member')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] })
      toast.success('Member suspended successfully')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to suspend member'
      )
    },
  })

  // Activate member mutation
  const activateMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      newDueDate,
    }: {
      memberId: string
      newDueDate: string
    }) => {
      const response = await fetch(`/api/members/${memberId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDueDate }),
      })

      if (!response.ok) {
        // ApiResponse envelope: {success:false, error:{message, code}}
        const body = await response.json().catch(() => null)
        const err = new Error(
          body?.error?.message || body?.error || 'Failed to activate member'
        ) as Error & { code?: string }
        err.code = body?.error?.code
        throw err
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] })
      toast.success('Member activated successfully')
      setShowActivateDialog(false)
      setActivateNewDueDate('')
    },
    onError: (error) => {
      // Active-member quota exhausted -> upgrade pop-up instead of a toast
      if (
        (error as Error & { code?: string }).code === 'MEMBER_LIMIT_REACHED'
      ) {
        setShowActivateDialog(false)
        setShowReactivationLimit(true)
        return
      }
      toast.error(
        error instanceof Error ? error.message : 'Failed to activate member'
      )
    },
  })

  // Cancel member mutation
  const cancelMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/members/${memberId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel member')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] })
      toast.success('Member cancelled successfully')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel member'
      )
    },
  })

  // Mark regular payment as paid
  const markRegularPaidMutation = useMutation({
    mutationFn: async (paymentDate: string) => {
      if (!member) throw new Error('No member selected')

      // The one implementation of "what does this member owe" (R5). This block
      // used to do the arithmetic inline and — unlike the other three copies —
      // did not round, so a 33% discount on 3,333 produced
      // 2233.1099999999997 as the amount charged. `numeric(10,2)` absorbed it
      // on insert, but the figure shown in the confirm dialog and passed to the
      // receipt was the unrounded one.
      //
      // Only a *recurring* discount applies to a renewal: a one-off discount
      // was consumed by the payment it was granted for.
      const effectiveAmount = PaymentCalculator.calculateAmount(
        member.plan_amount,
        member.discount && member.recurring_discount
          ? {
              discountId: member.discount.id,
              discountName: member.discount.discount_name,
              discountPercentage: member.discount.discount_percentage,
            }
          : null
      )

      const res = await fetch(`/api/members/${member.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmount: member.plan_amount,
          paymentAmount: effectiveAmount,
          paymentDate: paymentDate,
          discountId: member.discount?.id ?? undefined,
          deductOverduePeriod: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const err = new Error(
          body?.error?.message || 'Failed to collect payment'
        ) as Error & { code?: string }
        err.code = body?.error?.code
        throw err
      }
      return res.json()
    },
    onMutate: () => {
      setIsMarkingRegularPaid(true)
    },
    onSuccess: () => {
      setIsMarkingRegularPaid(false)
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] })
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] })
      toast.success('Payment collected — receipt SMS sent')
    },
    onError: (error) => {
      setIsMarkingRegularPaid(false)
      // Paying to reactivate an expired member can hit the active-member quota;
      // the flip is blocked before anything is charged (see CollectPayment).
      if (
        (error as Error & { code?: string }).code === 'MEMBER_LIMIT_REACHED'
      ) {
        setShowReactivationLimit(true)
        return
      }
      toast.error(
        error instanceof Error ? error.message : 'Failed to collect payment'
      )
    },
  })

  // Handler for mark paid dialog confirmation
  const handleMarkPaidConfirm = (paymentDate: string) => {
    markRegularPaidMutation.mutate(paymentDate)
    setShowMarkPaidDialog(false)
  }

  // Reactivate a cancelled/suspended member with a fresh payment. Reuses the
  // payment endpoint (which flips status to active) but also allows switching
  // the plan; the server sends the reactivation SMS for these members.
  const reactivateMutation = useMutation({
    mutationFn: async (values: ReactivationConfirm) => {
      if (!member) throw new Error('No member selected')

      const res = await fetch(`/api/members/${member.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: values.planType,
          planAmount: values.planAmount,
          paymentAmount: values.paymentAmount,
          paymentDate: values.paymentDate,
          deductOverduePeriod: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const err = new Error(
          body?.error?.message || 'Failed to reactivate member'
        ) as Error & { code?: string }
        err.code = body?.error?.code
        throw err
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['regular-payments'] })
      queryClient.invalidateQueries({ queryKey: ['member-detail', member?.id] })
      setShowReactivateDialog(false)
      toast.success('Member reactivated — confirmation SMS sent')
    },
    onError: (error) => {
      // Reactivation flips into active and can hit the active-member quota;
      // the flip is blocked before anything is charged (see CollectPayment).
      if (
        (error as Error & { code?: string }).code === 'MEMBER_LIMIT_REACHED'
      ) {
        setShowReactivateDialog(false)
        setShowReactivationLimit(true)
        return
      }
      toast.error(
        error instanceof Error ? error.message : 'Failed to reactivate member'
      )
    },
  })

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errorMessage = await parseApiError(res)
        throw new Error(errorMessage)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Member deleted successfully')
      setShowDeleteDialog(false)
      onClose()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete member'
      )
    },
  })

  // Show skeleton inside the open dialog while data is loading
  if (!member) {
    return (
      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        size="lg"
        placement={detailPlacement}
        title="Member Details"
        description="View and manage member information"
      >
        <div className="space-y-6 animate-pulse">
          {/* Name + badges skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-6 w-40 rounded bg-surface-selected" />
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-full bg-surface-selected" />
              <div className="h-5 w-16 rounded-full bg-surface-selected" />
            </div>
          </div>
          {/* Field grid skeleton */}
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-24 rounded bg-surface-selected" />
                <div className="h-4 w-32 rounded bg-surface-selected" />
              </div>
            ))}
          </div>
          {/* Plan section skeleton */}
          <div className="border-t border-line-1 pt-4 space-y-4">
            <div className="h-4 w-28 rounded bg-surface-selected" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-24 rounded bg-surface-selected" />
                  <div className="h-4 w-32 rounded bg-surface-selected" />
                </div>
              ))}
            </div>
          </div>
          {/* Status + actions skeleton */}
          <div className="h-24 rounded-sm bg-surface-input" />
          <div className="h-16 rounded-sm bg-surface-input" />
        </div>
      </Modal>
    )
  }

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB')
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return `LKR ${amount.toFixed(2)}`
  }

  // Map member status to a design-system badge variant
  const getStatusVariant = (status: string): BadgeProps['variant'] => {
    switch (status) {
      case 'active':
        return 'success'
      case 'expired':
        return 'error'
      case 'suspended':
        return 'warning'
      case 'cancelled':
        return 'neutral'
      default:
        return 'success'
    }
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        size="lg"
        placement={detailPlacement}
        title="Member Details"
        description="View and manage member information"
        footerStart={
          /*
           * Both carry an icon and no text, so `aria-label` supplies the
           * accessible name (plan §10 step 4). `title` alone is the LAST
           * fallback in the accessible-name algorithm — it happens to produce
           * a name today, which is why this reads like a no-op, but it is the
           * one source that a UA may skip, that touch never surfaces, and that
           * any future `aria-hidden`/`alt` on the icon would displace. The
           * `title` stays: it is the desktop hover tooltip.
           */
          <div className="flex gap-2">
            <Button
              variant="destructive-ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              aria-label="Delete member"
              title="Delete member"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={onEditClick}
              aria-label="Edit member"
              title="Edit member"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {member.status === 'cancelled' || member.status === 'suspended' ? (
              <Button
                variant="accent"
                onClick={() => setShowReactivateDialog(true)}
                disabled={reactivateMutation.isPending}
                loading={reactivateMutation.isPending}
              >
                {reactivateMutation.isPending
                  ? 'Reactivating...'
                  : 'Re-activate'}
              </Button>
            ) : (
              <Button
                variant="accent"
                onClick={() => setShowMarkPaidDialog(true)}
                disabled={isMarkingRegularPaid}
                loading={isMarkingRegularPaid}
              >
                {isMarkingRegularPaid ? 'Processing...' : 'Mark Paid'}
              </Button>
            )}
          </>
        }
      >
        {/*
         * Phone section order (plan §10 step 5, blueprint §26): identity →
         * plan → status actions → photo → door access → payment history →
         * SMS history. The DOM order below is the DESKTOP order and does not
         * change, so the reading order a screen reader gets on a desktop is
         * untouched and the 1366 rendering is untouched.
         *
         * The column has to be a flex container for `order` to mean anything,
         * and `space-y-6` has to go with it: its margin lands between DOM
         * siblings, not visual ones, so with `order` applied it would put a
         * gap above the visually-first block and none above the fourth.
         * `phone:gap-6` is the same 24 px, measured between what the reader
         * actually sees.
         *
         * The orders are NEGATIVE on purpose. `accessSlot` is a bare slot with
         * no element of ours to hang a class on, and wrapping it would add a
         * permanent empty child — `MemberAccessPanel` renders null for every
         * gym without the hardware, and a wrapper would turn that nothing into
         * a 24 px gap. Leaving it at the default `order: 0` and pulling the
         * four blocks above it to -4…-1 puts it exactly where it belongs,
         * fifth, with nothing added. A new section added here needs an
         * explicit order or it will land beside the door-access slot.
         */}
        <div className="space-y-6 phone:flex phone:flex-col phone:gap-6 phone:space-y-0">
          {/* Member Photo & Verification */}
          <MemberPhotoSection member={member} className="phone:-order-1" />

          {/* Member Information */}
          <div className="space-y-4 phone:-order-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{member.name}</h3>
                <p className="text-xs font-mono text-ink-muted">
                  Member ID: {formatMemberNumber(member.member_number)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(member.status)}>
                  {member.status}
                </Badge>
                <Badge variant="neutral">{member.plan_type}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-ink-muted">Phone Number</Label>
                <p className="text-sm font-medium">{member.phone_number}</p>
              </div>

              <div>
                <Label className="text-sm text-ink-muted">
                  Registered Date
                </Label>
                <p className="text-sm font-medium">
                  {formatDate(member.registered_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Membership Plan */}
          <div className="space-y-4 border-t border-line-1 pt-4 phone:-order-3">
            <h3 className="text-sm font-semibold">Membership Plan</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-ink-muted">Plan Type</Label>
                <p className="text-sm font-medium capitalize">
                  {member.plan_type}
                </p>
              </div>

              <div>
                <Label className="text-sm text-ink-muted">Plan Amount</Label>
                <p className="text-sm font-medium">
                  {formatCurrency(member.plan_amount)}
                </p>
              </div>

              <div>
                <Label className="text-sm text-ink-muted">
                  Membership Start
                </Label>
                <p className="text-sm font-medium">
                  {formatDate(member.membership_start_date)}
                </p>
              </div>

              <div>
                <Label className="text-sm text-ink-muted">Next Due Date</Label>
                <p className="text-sm font-medium">
                  {formatDate(member.next_due_date)}
                </p>
              </div>

              {member.discount && (
                <>
                  <div>
                    <Label className="text-sm text-ink-muted">Discount</Label>
                    <p className="text-sm font-medium">
                      {member.discount.discount_name} (
                      {member.discount.discount_percentage}%)
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm text-ink-muted">
                      Recurring Discount
                    </Label>
                    <p className="text-sm font-medium">
                      {member.recurring_discount ? 'Yes' : 'No'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status Actions — context-aware action buttons based on current status */}
          <div className="space-y-3 rounded-sm border border-accentui-border bg-accentui-bg p-4 phone:-order-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Status Actions</h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                Available actions based on current status:{' '}
                <strong>{member.status}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Active → Can Suspend */}
              {member.status === 'active' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={suspendMemberMutation.isPending}
                  onClick={() => suspendMemberMutation.mutate(member.id)}
                >
                  {suspendMemberMutation.isPending
                    ? 'Suspending...'
                    : 'Suspend Member'}
                </Button>
              )}

              {/* Expired or Suspended → Can Activate */}
              {(member.status === 'expired' ||
                member.status === 'suspended') && (
                <Button
                  size="sm"
                  variant="success-ghost"
                  disabled={activateMemberMutation.isPending}
                  onClick={() => setShowActivateDialog(true)}
                >
                  {activateMemberMutation.isPending
                    ? 'Activating...'
                    : 'Activate Member'}
                </Button>
              )}

              {/* Expired or Suspended → Can Cancel */}
              {(member.status === 'expired' ||
                member.status === 'suspended') && (
                <Button
                  size="sm"
                  variant="destructive-ghost"
                  disabled={cancelMemberMutation.isPending}
                  onClick={() => cancelMemberMutation.mutate(member.id)}
                >
                  {cancelMemberMutation.isPending
                    ? 'Cancelling...'
                    : 'Cancel Member'}
                </Button>
              )}

              {/* Cancelled → Reactivate with a fresh payment (see footer) */}
              {member.status === 'cancelled' && (
                <p className="text-sm text-ink-secondary italic">
                  Use <strong>Re-activate</strong> below to bring this member
                  back with a new payment.
                </p>
              )}
            </div>
          </div>

          {/* Door access, when the caller supplies it. Sits above payment
              history because "why can't they get in" is asked far more often
              than "what have they paid". */}
          {accessSlot}

          {/* SMS History — sibling of Payment History. Imported through the
              SMS feature's barrel (R4); members does not reach into its
              internals. */}
          <MemberSmsHistory memberId={member.id} className="phone:order-2" />

          {/* Payment History — distinct container */}
          <div className="space-y-3 rounded-sm border border-line-1 bg-surface-input p-4 phone:order-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Payment History
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  {payments.length} payment{payments.length !== 1 ? 's' : ''}{' '}
                  recorded
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPaymentHistory(!showPaymentHistory)}
              >
                {showPaymentHistory ? 'Hide' : 'View'} Payment History
              </Button>
            </div>

            {showPaymentHistory && (
              <div>
                {payments.length > 0 ? (
                  tier === 'phone' ? (
                    /*
                     * A list, not a table, on a phone (§9.2, §12 category A).
                     *
                     * Not a refinement — a REGRESSION FIX. The deleted
                     * `MemberDetailModalMobile` rendered these as cards, and
                     * making the desktop component serve both tiers put its
                     * four-column `Table` on a phone: 405 px wide, overflowing
                     * 320, 360, 390 and 430 alike. §10 called this phase a
                     * "minimal parity change" on the assumption the desktop
                     * component was a superset of the fork; for this one block
                     * it was not.
                     *
                     * Every column the table shows has a home here (§12: "no
                     * cell is dropped without a listed home") — date as the
                     * primary, amount as the trailing value, discount and next
                     * due date on the meta line, day pass as the status badge.
                     */
                    <ul role="list" className="-mx-4">
                      {payments.map((payment) => (
                        <ListRow
                          key={payment.id}
                          primary={formatDate(payment.payment_date)}
                          status={
                            payment.payment_type === 'day_pass' ? (
                              <Badge variant="warning">Day Pass</Badge>
                            ) : undefined
                          }
                          meta={[
                            payment.discount_applied
                              ? `${payment.discount_applied} (${payment.discount_percentage}%)`
                              : '',
                            `Next due ${formatDate(payment.next_due_date_calculated)}`,
                          ]}
                          value={formatCurrency(payment.amount_paid)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Next Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <span className="flex items-center gap-2">
                                {formatDate(payment.payment_date)}
                                {payment.payment_type === 'day_pass' && (
                                  <Badge variant="warning">Day Pass</Badge>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amount_paid)}
                            </TableCell>
                            <TableCell>
                              {payment.discount_applied ? (
                                <span className="text-sm text-success">
                                  {payment.discount_applied} (
                                  {payment.discount_percentage}%)
                                </span>
                              ) : (
                                <span className="text-sm text-ink-muted">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatDate(payment.next_due_date_calculated)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                ) : (
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-sm text-ink-muted">No payment history</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Are you sure?"
        // Explicit, though it is also the default: §11 classifies a
        // confirmation as `center` on every tier, and a reader should see
        // that the answer was chosen rather than inherited.
        placement="center"
        destructive
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMemberMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMemberMutation.mutate(member.id)}
              loading={deleteMemberMutation.isPending}
              disabled={deleteMemberMutation.isPending}
            >
              {deleteMemberMutation.isPending ? 'Deleting...' : 'Delete Member'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-ink-secondary">
          This will permanently delete <strong>{member.name}</strong> and all
          associated data including:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              Payment history ({payments.length} payment
              {payments.length !== 1 ? 's' : ''})
            </li>
            <li>SMS logs</li>
          </ul>
          <p className="mt-3 text-error font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Modal>

      {/* Mark Paid Dialog */}
      <MarkPaidDialog
        open={showMarkPaidDialog}
        onOpenChange={setShowMarkPaidDialog}
        memberName={member.name}
        amount={
          member.discount && member.recurring_discount
            ? member.plan_amount -
              (member.plan_amount * member.discount.discount_percentage) / 100
            : member.plan_amount
        }
        planType={member.plan_type}
        currentDueDate={member.next_due_date}
        onConfirm={handleMarkPaidConfirm}
      />

      {/* Reactivation Dialog (cancelled/suspended → active with payment) */}
      <ReactivationDialog
        open={showReactivateDialog}
        onOpenChange={setShowReactivateDialog}
        memberName={member.name}
        currentPlanType={member.plan_type}
        currentPlanAmount={member.plan_amount}
        currentDueDate={member.next_due_date}
        onConfirm={(values) => reactivateMutation.mutate(values)}
      />

      {/* Activate Member Dialog */}
      <Modal
        open={showActivateDialog}
        onOpenChange={setShowActivateDialog}
        title="Activate Member"
        // One control and one decision — §11's sheet case.
        placement="sheet"
        description={
          <>
            Select the new due date for <strong>{member.name}</strong>&apos;s
            membership.
          </>
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowActivateDialog(false)}
              disabled={activateMemberMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                if (!activateNewDueDate) {
                  toast.error('Please select a new due date')
                  return
                }
                activateMemberMutation.mutate({
                  memberId: member.id,
                  newDueDate: activateNewDueDate,
                })
              }}
              loading={activateMemberMutation.isPending}
              disabled={activateMemberMutation.isPending || !activateNewDueDate}
            >
              {activateMemberMutation.isPending
                ? 'Activating...'
                : 'Activate Member'}
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="newDueDate" className="text-sm font-medium">
            New Due Date
          </Label>
          <Input
            id="newDueDate"
            type="date"
            value={activateNewDueDate}
            onChange={(e) => setActivateNewDueDate(e.target.value)}
            className="mt-2"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </Modal>

      {/* Active-member quota reached while (re)activating */}
      <ReactivationLimitDialog
        open={showReactivationLimit}
        onOpenChange={setShowReactivationLimit}
      />
    </>
  )
}
