'use client'

import { useState, type ReactNode } from 'react'
// Deep import: a feature barrel may re-export server-only services.
import { PaymentCalculator } from '@/features/payments/domain/PaymentCalculator'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Edit, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Modal,
  Button,
  Badge,
  type BadgeProps,
  Input,
  Label,
} from '@/components/ui'
import ReactivationDialog, {
  type ReactivationConfirm,
} from '@/features/payments/components/ReactivationDialog'
import ReactivationLimitDialog from '@/features/subscriptions/components/ReactivationLimitDialog'
import MemberPhotoSection from './MemberPhotoSection'
import type { MemberWithDiscount, Payment } from '@/features/members/types'
import { parseApiError } from '@/utils/api-error'
import { formatMemberNumber } from '@/features/members/utils/formatMemberNumber'

interface MemberDetailModalMobileProps {
  open: boolean
  onClose: () => void
  member: MemberWithDiscount | null
  payments?: Payment[]
  onEditClick: () => void
  /** Optional door-access panel, injected by the caller. See the responsive wrapper. */
  accessSlot?: ReactNode
}

export default function MemberDetailModalMobile({
  open,
  onClose,
  member,
  payments = [],
  accessSlot,
  onEditClick,
}: MemberDetailModalMobileProps) {
  const queryClient = useQueryClient()
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [isMarkingRegularPaid, setIsMarkingRegularPaid] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showActivateDialog, setShowActivateDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [activateNewDueDate, setActivateNewDueDate] = useState<string>('')
  // Active-member quota reached during an into-active transition.
  const [showReactivationLimit, setShowReactivationLimit] = useState(false)

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
      toast.success('Member suspended')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to suspend')
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
      toast.success('Member activated')
      setShowActivateDialog(false)
      setActivateNewDueDate('')
    },
    onError: (error) => {
      if (
        (error as Error & { code?: string }).code === 'MEMBER_LIMIT_REACHED'
      ) {
        setShowActivateDialog(false)
        setShowReactivationLimit(true)
        return
      }
      toast.error(error instanceof Error ? error.message : 'Failed to activate')
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
      toast.success('Member cancelled')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel')
    },
  })

  // Mark regular payment as paid
  const markRegularPaidMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error('No member selected')

      // Same single implementation as the desktop modal (R5). This copy had the
      // same missing rounding, so the two surfaces could charge amounts that
      // differed in the last decimal for the same member.
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

      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/members/${member.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planAmount: member.plan_amount,
          paymentAmount: effectiveAmount,
          paymentDate: today,
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
      toast.success('Payment collected — receipt sent')
    },
    onError: (error) => {
      setIsMarkingRegularPaid(false)
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

  if (!open) return null

  if (!member) {
    return (
      <div className="fixed inset-0 z-modal bg-surface-overlay flex items-end md:items-center justify-center">
        <div className="bg-surface-card w-full h-[90vh] md:max-w-lg md:h-auto md:rounded-t-sm rounded-t-sm p-6 animate-pulse">
          <div className="h-6 w-40 rounded bg-surface-selected mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-surface-selected" />
                <div className="h-4 w-32 rounded bg-surface-selected" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB')
  }

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
      {/* Mobile Full-Screen Modal */}
      <div className="fixed inset-0 z-modal bg-surface-overlay flex items-end md:items-center justify-center">
        <div className="bg-surface-card w-full h-[90vh] md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-t-sm rounded-t-sm flex flex-col overflow-hidden">
          {/* Sticky Header */}
          <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-line-1 bg-surface-card sticky top-0 z-sticky">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{member.name}</h2>
                <p className="text-xs font-mono text-ink-muted mt-0.5">
                  Member ID: {formatMemberNumber(member.member_number)}
                </p>
                <p className="text-sm text-ink-muted mt-1">
                  {member.phone_number}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface-hover rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(member.status)}>
                {member.status}
              </Badge>
              <Badge variant="neutral">{member.plan_type}</Badge>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Member Photo & Verification */}
            <MemberPhotoSection member={member} />

            {/* Basic Info */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-ink-muted">
                  Registered Date
                </Label>
                <p className="text-sm font-medium">
                  {formatDate(member.registered_date)}
                </p>
              </div>
            </div>

            {/* Membership Plan */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b border-line-1 pb-2">
                Membership Plan
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-ink-muted">Plan Amount</Label>
                  <p className="text-sm font-medium">
                    {formatCurrency(member.plan_amount)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-ink-muted">
                    Next Due Date
                  </Label>
                  <p className="text-sm font-medium">
                    {formatDate(member.next_due_date)}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-ink-muted">
                  Membership Start
                </Label>
                <p className="text-sm font-medium">
                  {formatDate(member.membership_start_date)}
                </p>
              </div>

              {member.discount && (
                <div className="pt-2 border-t border-line-1">
                  <Label className="text-xs text-ink-muted">Discount</Label>
                  <p className="text-sm font-medium">
                    {member.discount.discount_name} (
                    {member.discount.discount_percentage}%)
                    {member.recurring_discount && ' • Recurring'}
                  </p>
                </div>
              )}
            </div>

            {/* Status Actions */}
            <div className="rounded-sm border border-accentui-border bg-accentui-bg p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Status Actions
                </h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Current: <strong>{member.status}</strong>
                </p>
              </div>

              <div className="space-y-2">
                {/* Active → Can Suspend */}
                {member.status === 'active' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={suspendMemberMutation.isPending}
                    onClick={() => suspendMemberMutation.mutate(member.id)}
                    className="w-full"
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
                    className="w-full"
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
                    className="w-full"
                  >
                    {cancelMemberMutation.isPending
                      ? 'Cancelling...'
                      : 'Cancel Member'}
                  </Button>
                )}

                {/* Cancelled → Reactivate with a fresh payment (button below) */}
                {member.status === 'cancelled' && (
                  <p className="text-sm text-ink-secondary italic text-center py-2">
                    Use Re-activate below to bring this member back.
                  </p>
                )}
              </div>
            </div>

            {/* Door access, when the caller supplies it. Above payment
                history because "why can't they get in" is asked far more
                often than "what have they paid". */}
            {accessSlot}

            {/* Payment History */}
            <div className="rounded-sm border border-line-1 bg-surface-input p-4 space-y-3">
              <button
                onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                className="w-full flex items-center justify-between"
              >
                <div className="text-left">
                  <h3 className="text-sm font-semibold">Payment History</h3>
                  <p className="text-xs text-ink-muted">
                    {payments.length} payment{payments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {showPaymentHistory ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showPaymentHistory && (
                <div className="space-y-2 pt-2">
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="bg-surface-card rounded-sm p-3 border border-line-1"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-ink-muted">
                            {formatDate(payment.payment_date)}
                          </span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(payment.amount_paid)}
                          </span>
                        </div>
                        {payment.discount_applied && (
                          <p className="text-xs text-success">
                            {payment.discount_applied} (
                            {payment.discount_percentage}%)
                          </p>
                        )}
                        <p className="text-xs text-ink-muted mt-1">
                          Next due:{' '}
                          {formatDate(payment.next_due_date_calculated)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink-muted text-center py-4">
                      No payment history
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Primary payment action — Re-activate for cancelled/suspended,
                otherwise Mark Paid */}
            {member.status === 'cancelled' || member.status === 'suspended' ? (
              <Button
                variant="accent"
                onClick={() => setShowReactivateDialog(true)}
                disabled={reactivateMutation.isPending}
                loading={reactivateMutation.isPending}
                className="w-full h-12"
              >
                {reactivateMutation.isPending
                  ? 'Reactivating...'
                  : 'Re-activate'}
              </Button>
            ) : (
              <Button
                variant="accent"
                onClick={() => markRegularPaidMutation.mutate()}
                disabled={isMarkingRegularPaid}
                loading={isMarkingRegularPaid}
                className="w-full h-12"
              >
                {isMarkingRegularPaid
                  ? 'Processing...'
                  : `Mark Paid (${member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1)})`}
              </Button>
            )}
          </div>

          {/* Sticky Footer Actions */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-line-1 bg-surface-card flex gap-3">
            <Button
              variant="destructive-ghost"
              onClick={() => setShowDeleteDialog(true)}
              className="flex-1 h-12"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button
              variant="accent"
              onClick={onEditClick}
              className="flex-1 h-12"
            >
              <Edit className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Modal
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Member?"
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
              {deleteMemberMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-ink-secondary">
          This will permanently delete <strong>{member.name}</strong> and all
          data:
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>
              {payments.length} payment{payments.length !== 1 ? 's' : ''}
            </li>
            <li>SMS logs</li>
          </ul>
          <p className="mt-3 text-error font-semibold text-sm">
            This cannot be undone.
          </p>
        </div>
      </Modal>

      {/* Activate Member Dialog */}
      <Modal
        open={showActivateDialog}
        onOpenChange={setShowActivateDialog}
        title="Activate Member"
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
              {activateMemberMutation.isPending ? 'Activating...' : 'Activate'}
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

      {/* Reactivation Dialog (cancelled/suspended → active with payment) */}
      <ReactivationDialog
        open={showReactivateDialog}
        onOpenChange={setShowReactivateDialog}
        memberName={member.name}
        currentPlanType={member.plan_type}
        currentPlanAmount={member.plan_amount}
        onConfirm={(values) => reactivateMutation.mutate(values)}
      />

      {/* Active-member quota reached while (re)activating */}
      <ReactivationLimitDialog
        open={showReactivationLimit}
        onOpenChange={setShowReactivationLimit}
      />
    </>
  )
}
