'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Edit, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
}

export default function MemberDetailModalMobile({
  open,
  onClose,
  member,
  payments = [],
  onEditClick,
}: MemberDetailModalMobileProps) {
  const queryClient = useQueryClient()
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [isMarkingRegularPaid, setIsMarkingRegularPaid] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showActivateDialog, setShowActivateDialog] = useState(false)
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

      let effectiveAmount = member.plan_amount
      if (member.discount && member.recurring_discount) {
        const discountAmount =
          (member.plan_amount * member.discount.discount_percentage) / 100
        effectiveAmount = member.plan_amount - discountAmount
      }

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
      <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
        <div className="bg-white w-full h-[90vh] md:max-w-lg md:h-auto md:rounded-t-2xl rounded-t-2xl p-6 animate-pulse">
          <div className="h-6 w-40 rounded bg-gray-200 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
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

  const getStatusClassName = (status: string): string => {
    switch (status) {
      case 'active':
        return 'border-transparent bg-green-100 text-green-800'
      case 'expired':
        return 'border-transparent bg-red-100 text-red-800'
      case 'suspended':
        return 'border-transparent bg-amber-100 text-amber-800'
      case 'cancelled':
        return 'border border-gray-300 text-gray-600 bg-transparent'
      default:
        return 'border-transparent bg-green-100 text-green-800'
    }
  }

  const getPlanClassName = (planType: string): string => {
    switch (planType) {
      case 'monthly':
        return 'border-transparent bg-blue-100 text-blue-800'
      case 'daily':
        return 'border-transparent bg-orange-100 text-orange-800'
      case 'annual':
        return 'border-transparent bg-purple-100 text-purple-800'
      default:
        return 'border-transparent bg-blue-100 text-blue-800'
    }
  }

  return (
    <>
      {/* Mobile Full-Screen Modal */}
      <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center">
        <div className="bg-white w-full h-[90vh] md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-t-2xl rounded-t-2xl flex flex-col overflow-hidden">
          {/* Sticky Header */}
          <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b bg-white sticky top-0 z-10">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{member.name}</h2>
                <p className="text-xs font-mono text-gray-500 mt-0.5">
                  Member ID: {formatMemberNumber(member.member_number)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {member.phone_number}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusClassName(member.status)}>
                {member.status}
              </Badge>
              <Badge className={getPlanClassName(member.plan_type)}>
                {member.plan_type}
              </Badge>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Member Photo & Verification */}
            <MemberPhotoSection member={member} />

            {/* Basic Info */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Registered Date</Label>
                <p className="text-sm font-medium">
                  {formatDate(member.registered_date)}
                </p>
              </div>
            </div>

            {/* Membership Plan */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-2">
                Membership Plan
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Plan Amount</Label>
                  <p className="text-sm font-medium">
                    {formatCurrency(member.plan_amount)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Next Due Date</Label>
                  <p className="text-sm font-medium">
                    {formatDate(member.next_due_date)}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">
                  Membership Start
                </Label>
                <p className="text-sm font-medium">
                  {formatDate(member.membership_start_date)}
                </p>
              </div>

              {member.discount && (
                <div className="pt-2 border-t">
                  <Label className="text-xs text-gray-500">Discount</Label>
                  <p className="text-sm font-medium">
                    {member.discount.discount_name} (
                    {member.discount.discount_percentage}%)
                    {member.recurring_discount && ' • Recurring'}
                  </p>
                </div>
              )}
            </div>

            {/* Status Actions */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  Status Actions
                </h3>
                <p className="text-xs text-blue-700 mt-0.5">
                  Current: <strong>{member.status}</strong>
                </p>
              </div>

              <div className="space-y-2">
                {/* Active → Can Suspend */}
                {member.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={suspendMemberMutation.isPending}
                    onClick={() => suspendMemberMutation.mutate(member.id)}
                    className="w-full border-amber-600 text-amber-700 hover:bg-amber-50"
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
                    variant="outline"
                    disabled={activateMemberMutation.isPending}
                    onClick={() => setShowActivateDialog(true)}
                    className="w-full border-green-600 text-green-700 hover:bg-green-50"
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
                    variant="outline"
                    disabled={cancelMemberMutation.isPending}
                    onClick={() => cancelMemberMutation.mutate(member.id)}
                    className="w-full border-red-600 text-red-700 hover:bg-red-50"
                  >
                    {cancelMemberMutation.isPending
                      ? 'Cancelling...'
                      : 'Cancel Member'}
                  </Button>
                )}

                {/* Cancelled → No actions available */}
                {member.status === 'cancelled' && (
                  <p className="text-sm text-gray-600 italic text-center py-2">
                    No actions available
                  </p>
                )}
              </div>
            </div>

            {/* Payment History */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
              <button
                onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                className="w-full flex items-center justify-between"
              >
                <div className="text-left">
                  <h3 className="text-sm font-semibold">Payment History</h3>
                  <p className="text-xs text-gray-500">
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
                        className="bg-white rounded-lg p-3 border"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-500">
                            {formatDate(payment.payment_date)}
                          </span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(payment.amount_paid)}
                          </span>
                        </div>
                        {payment.discount_applied && (
                          <p className="text-xs text-green-600">
                            {payment.discount_applied} (
                            {payment.discount_percentage}%)
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Next due:{' '}
                          {formatDate(payment.next_due_date_calculated)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No payment history
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Mark Paid Button */}
            <Button
              onClick={() => markRegularPaidMutation.mutate()}
              disabled={isMarkingRegularPaid}
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12"
            >
              {isMarkingRegularPaid
                ? 'Processing...'
                : `Mark Paid (${member.plan_type.charAt(0).toUpperCase() + member.plan_type.slice(1)})`}
            </Button>
          </div>

          {/* Sticky Footer Actions */}
          <div className="flex-shrink-0 px-6 py-4 border-t bg-white flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-12"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <Button onClick={onEditClick} className="flex-1 h-12">
              <Edit className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{member.name}</strong> and
              all data:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>
                  {payments.length} payment{payments.length !== 1 ? 's' : ''}
                </li>
                <li>SMS logs</li>
              </ul>
              <p className="mt-3 text-red-600 font-semibold text-sm">
                This cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMemberMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMemberMutation.mutate(member.id)}
              disabled={deleteMemberMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMemberMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Member Dialog */}
      <AlertDialog
        open={showActivateDialog}
        onOpenChange={setShowActivateDialog}
      >
        <AlertDialogContent className="max-w-[90vw] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Member</AlertDialogTitle>
            <AlertDialogDescription>
              Select the new due date for <strong>{member.name}</strong>&apos;s
              membership.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activateMemberMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
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
              disabled={activateMemberMutation.isPending || !activateNewDueDate}
              className="bg-green-600 hover:bg-green-700"
            >
              {activateMemberMutation.isPending ? 'Activating...' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active-member quota reached while (re)activating */}
      <ReactivationLimitDialog
        open={showReactivationLimit}
        onOpenChange={setShowReactivationLimit}
      />
    </>
  )
}
