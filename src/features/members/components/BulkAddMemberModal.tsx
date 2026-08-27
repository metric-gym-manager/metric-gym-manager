'use client'

import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Modal, Button, Input, Badge } from '@/components/ui'
import { Trash2, Plus, CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import { parseApiError } from '@/utils/api-error'
import QuotaReachedUpsell from '@/features/subscriptions/components/QuotaReachedUpsell'

interface Discount {
  id: string
  discount_name: string
  discount_percentage: number
}

interface PlanType {
  id: string
  gym_id: string
  plan_type: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual'
  default_amount: number
  is_active: boolean
}

interface BulkRow {
  id: string
  name: string
  phoneNumber: string
  planType: 'daily' | 'weekly' | 'monthly' | '3-months' | '6-months' | 'annual'
  planAmount: number
  membershipStartDate: string
  discountId: string | null
  recurringDiscount: boolean
  status: 'idle' | 'success' | 'error'
  errorMessage?: string
}

interface BulkAddMemberModalProps {
  open: boolean
  onClose: () => void
}

const TODAY = new Date().toISOString().split('T')[0]

function createEmptyRow(): BulkRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    phoneNumber: '',
    planType: 'monthly',
    planAmount: 0, // Will be set when plan types are loaded
    membershipStartDate: TODAY,
    discountId: null,
    recurringDiscount: false,
    status: 'idle',
  }
}

function computeDiscountedAmount(
  planAmount: number,
  discountPct: number
): number {
  return Math.round(planAmount * (1 - discountPct / 100) * 100) / 100
}

export default function BulkAddMemberModal({
  open,
  onClose,
}: BulkAddMemberModalProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<BulkRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ])
  const [submitted, setSubmitted] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const tableEndRef = useRef<HTMLDivElement>(null)

  // Apply-to-all: plan
  const [globalPlanType, setGlobalPlanType] =
    useState<BulkRow['planType']>('monthly')
  const [globalPlanAmount, setGlobalPlanAmount] = useState<number>(0)
  const [globalStartDate, setGlobalStartDate] = useState<string>(TODAY)

  // Apply-to-all: discount
  const [globalDiscountId, setGlobalDiscountId] = useState<string>('')
  const [globalRecurring, setGlobalRecurring] = useState(false)

  const { data: planTypesData } = useQuery<PlanType[]>({
    queryKey: ['billing-setup-plan-types'],
    queryFn: async () => {
      const res = await fetch('/api/billing-setup/plans')
      if (!res.ok) throw new Error('Failed to fetch plan types')
      const r = await res.json()
      return r.data
    },
  })

  const { data: discountsData } = useQuery<Discount[]>({
    queryKey: ['billing-setup-discounts'],
    queryFn: async () => {
      const res = await fetch('/api/billing-setup/discounts')
      if (!res.ok) throw new Error('Failed to fetch discounts')
      const r = await res.json()
      return r.data
    },
  })

  // Render-time state adjustments (React "storing information from previous
  // renders" pattern) instead of setState-in-effect.
  const [prevPlanTypesData, setPrevPlanTypesData] = useState<
    PlanType[] | undefined
  >(undefined)
  const [prevGlobalPlanType, setPrevGlobalPlanType] = useState<
    BulkRow['planType'] | null
  >(null)

  if (planTypesData !== prevPlanTypesData) {
    // Initialize with first available plan type when data loads
    setPrevPlanTypesData(planTypesData)
    if (planTypesData && planTypesData.length > 0) {
      const activePlans = planTypesData.filter((pt) => pt.is_active)
      if (activePlans.length > 0) {
        const firstPlan = activePlans[0]
        setGlobalPlanType(firstPlan.plan_type)
        setPrevGlobalPlanType(firstPlan.plan_type)
        setGlobalPlanAmount(firstPlan.default_amount)

        // Initialize all rows with first plan
        setRows((prev) =>
          prev.map((row) => ({
            ...row,
            planType: firstPlan.plan_type,
            planAmount: firstPlan.default_amount,
          }))
        )
      }
    }
  } else if (globalPlanType !== prevGlobalPlanType) {
    // Auto-fill global plan amount when global plan type changes
    setPrevGlobalPlanType(globalPlanType)
    if (globalPlanType && planTypesData) {
      const planType = planTypesData.find(
        (pt) => pt.plan_type === globalPlanType
      )
      if (planType && planType.default_amount > 0) {
        setGlobalPlanAmount(planType.default_amount)
      }
    }
  }

  // Derive discounted amount for a row
  const getRowDiscountPct = (row: BulkRow): number => {
    if (!row.discountId) return 0
    return (
      discountsData?.find((d) => d.id === row.discountId)
        ?.discount_percentage ?? 0
    )
  }

  const bulkRegisterMutation = useMutation({
    mutationFn: async (members: BulkRow[]) => {
      const payload = members.map((row) => {
        return {
          name: row.name.trim(),
          phoneNumber: row.phoneNumber.trim(),
          planType: row.planType,
          planAmount: row.planAmount,
          paymentAmount: row.planAmount,
          membershipStartDate: row.membershipStartDate,
          discountId: row.discountId || null,
          recurringDiscount: row.recurringDiscount,
        }
      })

      const response = await fetch('/api/members/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: payload }),
      })

      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      return response.json()
    },
    onSuccess: (result) => {
      const { results, summary } = result.data

      setRows((prev) =>
        prev.map((row, i) => {
          const match = results.find(
            (r: { index: number; success: boolean; error?: string }) =>
              r.index === i
          )
          if (!match) return row
          return {
            ...row,
            status: match.success ? 'success' : 'error',
            errorMessage: match.error,
          }
        })
      )

      // Free-tier quota hit on one or more rows: show the upgrade path
      setLimitReached(
        results.some(
          (r: { errorCode?: string }) => r.errorCode === 'MEMBER_LIMIT_REACHED'
        )
      )

      setSubmitted(true)
      queryClient.invalidateQueries({ queryKey: ['members'] })

      if (summary.failed === 0) {
        toast.success(
          `All ${summary.succeeded} members registered successfully`
        )
      } else {
        toast.warning(
          `${summary.succeeded} registered, ${summary.failed} failed — review errors below`
        )
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Bulk registration failed'
      )
    },
  })

  const handleRowChange = (
    id: string,
    field: keyof BulkRow,
    value: string | number | boolean | null
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const updated = {
          ...row,
          [field]: value,
          status: 'idle' as const,
          errorMessage: undefined,
        }
        if (field === 'planType') {
          const planType = planTypesData?.find((pt) => pt.plan_type === value)
          updated.planAmount = planType?.default_amount ?? 0
        }
        return updated
      })
    )
  }

  const handleApplyPlanToAll = () => {
    setRows((prev) =>
      prev.map((row) =>
        row.status === 'success'
          ? row
          : {
              ...row,
              planType: globalPlanType,
              planAmount: globalPlanAmount,
              membershipStartDate: globalStartDate,
              status: 'idle' as const,
              errorMessage: undefined,
            }
      )
    )
  }

  const handleApplyDiscountToAll = () => {
    setRows((prev) =>
      prev.map((row) =>
        row.status === 'success'
          ? row
          : {
              ...row,
              discountId: globalDiscountId || null,
              recurringDiscount: globalRecurring,
              status: 'idle' as const,
              errorMessage: undefined,
            }
      )
    )
  }

  const handleAddRow = () => {
    const activePlan =
      planTypesData?.find(
        (pt) => pt.is_active && pt.plan_type === globalPlanType
      ) ?? planTypesData?.find((pt) => pt.is_active)
    const newRow: BulkRow = {
      ...createEmptyRow(),
      planType: activePlan?.plan_type ?? 'monthly',
      planAmount: activePlan?.default_amount ?? globalPlanAmount,
    }
    setRows((prev) => [...prev, newRow])
    setTimeout(
      () => tableEndRef.current?.scrollIntoView({ behavior: 'smooth' }),
      50
    )
  }

  const handleDeleteRow = (id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((r) => r.id !== id)
    })
  }

  const validateRow = (row: BulkRow): string | null => {
    if (!row.name.trim()) return 'Name is required'
    if (!row.phoneNumber.trim()) return 'WhatsApp number is required'
    if (row.planAmount <= 0) return 'Plan amount must be > 0'
    if (!row.membershipStartDate) return 'Start date is required'
    return null
  }

  const validRows = rows.filter((r) => !validateRow(r))
  const hasAnyFilledRow = rows.some(
    (r) => r.name.trim() || r.phoneNumber.trim()
  )

  const handleRegisterAll = () => {
    const updatedRows = rows.map((row) => {
      const err = validateRow(row)
      if (err) return { ...row, status: 'error' as const, errorMessage: err }
      return { ...row, status: 'idle' as const, errorMessage: undefined }
    })
    setRows(updatedRows)

    const toSubmit = updatedRows.filter(
      (r) => r.status !== 'error' && validateRow(r) === null
    )
    if (toSubmit.length === 0) {
      toast.error('No valid rows to submit. Fix errors and try again.')
      return
    }

    bulkRegisterMutation.mutate(toSubmit)
  }

  const handleClose = () => {
    const activePlan = planTypesData?.filter((pt) => pt.is_active)?.[0]
    const defaultPlanType = activePlan?.plan_type ?? 'monthly'
    const defaultAmount = activePlan?.default_amount ?? 0

    const freshRows = [
      createEmptyRow(),
      createEmptyRow(),
      createEmptyRow(),
    ].map((row) => ({
      ...row,
      planType: defaultPlanType,
      planAmount: defaultAmount,
    }))

    setRows(freshRows)
    setSubmitted(false)
    setLimitReached(false)
    setGlobalPlanType(defaultPlanType)
    setGlobalPlanAmount(defaultAmount)
    setGlobalStartDate(TODAY)
    setGlobalDiscountId('')
    setGlobalRecurring(false)
    onClose()
  }

  const handleRetryFailed = () => {
    if (!rows.some((r) => r.status === 'error')) return
    setRows((prev) =>
      prev.map((r) =>
        r.status === 'error'
          ? { ...r, status: 'idle', errorMessage: undefined }
          : r
      )
    )
    setSubmitted(false)
    setLimitReached(false)
  }

  const successCount = rows.filter((r) => r.status === 'success').length
  const errorCount = rows.filter((r) => r.status === 'error').length
  const isPending = bulkRegisterMutation.isPending

  // Tokenized native <select> styling (matches the DS Select primitive treatment).
  const selectClass =
    'h-8 w-full rounded-md border border-line-2 bg-surface-input px-2 text-body text-ink focus-visible:border-focusring focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50'
  const toolbarSelectClass =
    'h-8 rounded-md border border-line-2 bg-surface-card px-2 text-body text-ink focus-visible:border-focusring focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50'

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
      size="lg"
      className="w-[1200px]"
      title="Bulk Register Members"
      description={
        <span className="flex items-start gap-1.5">
          <span>
            Use the toolbar to set defaults for all rows at once, then adjust
            individually as needed.
          </span>
          <span title="Apply to All: Set a value in the toolbar (plan, date, discount, or payment plan), then click 'Apply to All' to fill all rows with that value. You can still modify individual rows afterward.">
            <HelpCircle className="h-4 w-4 text-ink-muted cursor-help flex-shrink-0 mt-0.5" />
          </span>
        </span>
      }
      footerStart={
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddRow}
            disabled={isPending}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </Button>
          <span className="text-xs text-ink-muted">
            {validRows.length} of {rows.length} rows valid
          </span>
        </div>
      }
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isPending}
          >
            {submitted && errorCount === 0 ? 'Close' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant="accent"
            loading={isPending}
            onClick={handleRegisterAll}
            disabled={
              !hasAnyFilledRow ||
              isPending ||
              (submitted && errorCount === 0 && successCount > 0) ||
              !planTypesData ||
              planTypesData.filter((pt) => pt.is_active).length === 0
            }
          >
            {isPending
              ? 'Registering...'
              : submitted && errorCount > 0
                ? `Retry ${errorCount} Failed`
                : `Register All (${validRows.length})`}
          </Button>
        </>
      }
    >
      {planTypesData &&
        planTypesData.filter((pt) => pt.is_active).length === 0 && (
          <div className="rounded-md bg-warning-bg border border-warning-border p-4 mb-4">
            <p className="text-sm text-warning">
              <strong>No plan types configured.</strong> Please go to Settings →
              Plans to configure your membership plan types before adding
              members.
            </p>
          </div>
        )}

      {/* Summary bar */}
      {submitted && (
        <div className="flex items-center gap-4 rounded-lg border border-line-1 bg-surface-input px-4 py-3 text-sm mb-4">
          <span className="font-medium">Results:</span>
          {successCount > 0 && (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle className="h-4 w-4" /> {successCount} registered
            </span>
          )}
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 text-error">
              <XCircle className="h-4 w-4" /> {errorCount} failed
            </span>
          )}
          {limitReached && <QuotaReachedUpsell />}
          {errorCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleRetryFailed}>
              Retry Failed
            </Button>
          )}
        </div>
      )}

      {/* Apply-to-all toolbar */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border border-line-1 bg-surface-input px-4 py-3 mb-4">
        {/* Plan section */}
        <div className="flex items-end gap-2">
          <div>
            <label
              className="text-xs font-medium text-ink-secondary block mb-1"
              htmlFor="bulk-global-plan-type"
            >
              Plan Type
            </label>
            <select
              id="bulk-global-plan-type"
              value={globalPlanType}
              onChange={(e) => {
                setGlobalPlanType(e.target.value as BulkRow['planType'])
              }}
              disabled={isPending}
              className={`${toolbarSelectClass} w-[140px]`}
            >
              {planTypesData
                ?.filter((pt) => pt.is_active)
                .map((planType) => (
                  <option key={planType.id} value={planType.plan_type}>
                    {planType.plan_type.charAt(0).toUpperCase() +
                      planType.plan_type.slice(1).replace('-', ' ')}
                    {planType.default_amount > 0 &&
                      ` (${planType.default_amount})`}
                  </option>
                ))}
              {(!planTypesData ||
                planTypesData.filter((pt) => pt.is_active).length === 0) && (
                <option value="" disabled>
                  No plans
                </option>
              )}
            </select>
          </div>
          <div>
            <label
              className="text-xs font-medium text-ink-secondary block mb-1"
              htmlFor="bulk-global-amount"
            >
              Amount (Rs.)
            </label>
            <Input
              id="bulk-global-amount"
              type="number"
              value={globalPlanAmount}
              onChange={(e) =>
                setGlobalPlanAmount(parseFloat(e.target.value) || 0)
              }
              className="h-8 text-sm w-[110px]"
              disabled={isPending}
            />
          </div>
          <div>
            <label
              className="text-xs font-medium text-ink-secondary block mb-1"
              htmlFor="bulk-global-start-date"
            >
              Start Date
            </label>
            <Input
              id="bulk-global-start-date"
              type="date"
              value={globalStartDate}
              onChange={(e) => setGlobalStartDate(e.target.value)}
              className="h-8 text-sm w-[140px]"
              disabled={isPending}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleApplyPlanToAll}
            disabled={isPending}
            className="h-8"
          >
            Apply to All
          </Button>
        </div>

        <div className="w-px h-8 bg-line-2 self-end" />

        {/* Discount section */}
        <div className="flex items-end gap-2">
          <div>
            <label
              className="text-xs font-medium text-ink-secondary block mb-1"
              htmlFor="bulk-global-discount"
            >
              Discount
            </label>
            <select
              id="bulk-global-discount"
              value={globalDiscountId}
              onChange={(e) => setGlobalDiscountId(e.target.value)}
              disabled={isPending}
              className={`${toolbarSelectClass} min-w-[170px]`}
            >
              <option value="">No Discount</option>
              {discountsData?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.discount_name} ({d.discount_percentage}%)
                </option>
              ))}
            </select>
          </div>
          {globalDiscountId && (
            <label className="flex items-center gap-1 text-xs text-ink-secondary pb-1">
              <input
                type="checkbox"
                checked={globalRecurring}
                onChange={(e) => setGlobalRecurring(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Recurring
            </label>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleApplyDiscountToAll}
            disabled={isPending}
            className="h-8"
          >
            Apply to All
          </Button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto border border-line-1 rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-sticky bg-surface-input border-b border-line-1">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-ink-muted w-8">
                #
              </th>
              <th className="px-3 py-3 text-left font-medium text-ink-muted min-w-[160px]">
                Name <span className="text-error">*</span>
              </th>
              <th className="px-3 py-3 text-left font-medium text-ink-muted min-w-[140px]">
                WhatsApp <span className="text-error">*</span>
              </th>
              <th className="px-3 py-3 text-left font-medium text-ink-muted w-[120px]">
                Plan
              </th>
              <th className="px-3 py-3 text-left font-medium text-ink-muted w-[110px]">
                Amount (Rs.)
              </th>
              <th className="px-3 py-3 text-left font-medium text-ink-muted w-[140px]">
                Start Date
              </th>
              <th className="px-3 py-3 text-left font-medium text-ink-muted min-w-[180px]">
                Discount
              </th>
              <th className="px-3 py-3 text-left font-medium text-ink-muted w-[80px]">
                Status
              </th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const discountPct = getRowDiscountPct(row)
              const discountedAmount = computeDiscountedAmount(
                row.planAmount,
                discountPct
              )

              return (
                <tr
                  key={row.id}
                  className={`border-b border-line-1 transition-colors ${
                    row.status === 'success'
                      ? 'bg-success-bg'
                      : row.status === 'error'
                        ? 'bg-error-bg'
                        : 'hover:bg-surface-hover'
                  }`}
                >
                  <td className="px-3 py-2 text-ink-muted text-xs">
                    {index + 1}
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        handleRowChange(row.id, 'name', e.target.value)
                      }
                      placeholder="Member name"
                      className="h-8 text-sm"
                      disabled={row.status === 'success' || isPending}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      value={row.phoneNumber}
                      onChange={(e) =>
                        handleRowChange(row.id, 'phoneNumber', e.target.value)
                      }
                      placeholder="0771234567"
                      className="h-8 text-sm"
                      disabled={row.status === 'success' || isPending}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <select
                      value={row.planType}
                      onChange={(e) =>
                        handleRowChange(row.id, 'planType', e.target.value)
                      }
                      disabled={row.status === 'success' || isPending}
                      className={selectClass}
                    >
                      {planTypesData
                        ?.filter((pt) => pt.is_active)
                        .map((planType) => (
                          <option key={planType.id} value={planType.plan_type}>
                            {planType.plan_type.charAt(0).toUpperCase() +
                              planType.plan_type.slice(1).replace('-', ' ')}
                          </option>
                        ))}
                      {(!planTypesData ||
                        planTypesData.filter((pt) => pt.is_active).length ===
                          0) && (
                        <option value="" disabled>
                          No plans
                        </option>
                      )}
                    </select>
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={row.planAmount}
                      onChange={(e) =>
                        handleRowChange(
                          row.id,
                          'planAmount',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8 text-sm"
                      disabled={row.status === 'success' || isPending}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={row.membershipStartDate}
                      onChange={(e) =>
                        handleRowChange(
                          row.id,
                          'membershipStartDate',
                          e.target.value
                        )
                      }
                      className="h-8 text-sm"
                      disabled={row.status === 'success' || isPending}
                    />
                  </td>

                  {/* Discount */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <select
                        value={row.discountId ?? ''}
                        onChange={(e) =>
                          handleRowChange(
                            row.id,
                            'discountId',
                            e.target.value || null
                          )
                        }
                        disabled={row.status === 'success' || isPending}
                        className={selectClass}
                      >
                        <option value="">No Discount</option>
                        {discountsData?.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.discount_name} ({d.discount_percentage}%)
                          </option>
                        ))}
                      </select>
                      {row.discountId && (
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1 text-xs text-ink-secondary">
                            <input
                              type="checkbox"
                              checked={row.recurringDiscount}
                              onChange={(e) =>
                                handleRowChange(
                                  row.id,
                                  'recurringDiscount',
                                  e.target.checked
                                )
                              }
                              disabled={row.status === 'success' || isPending}
                              className="h-3 w-3"
                            />
                            Recurring
                          </label>
                          <span className="text-xs font-medium text-success">
                            Rs. {discountedAmount.toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    {row.status === 'success' && (
                      <Badge variant="success">
                        <CheckCircle className="h-3 w-3 mr-1" /> Done
                      </Badge>
                    )}
                    {row.status === 'error' && (
                      <div>
                        <Badge
                          variant="error"
                          className="cursor-help"
                          title={row.errorMessage}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Error
                        </Badge>
                        {row.errorMessage && (
                          <p
                            className="text-xs text-error mt-0.5 max-w-[80px] truncate"
                            title={row.errorMessage}
                          >
                            {row.errorMessage}
                          </p>
                        )}
                      </div>
                    )}
                    {row.status === 'idle' &&
                      (() => {
                        const validationError = validateRow(row)
                        const hasContent =
                          row.name.trim() || row.phoneNumber.trim()

                        if (!hasContent) {
                          return (
                            <span className="text-xs text-ink-muted">—</span>
                          )
                        }

                        if (validationError) {
                          return (
                            <Badge
                              variant="error"
                              className="cursor-help"
                              title={validationError}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Invalid
                            </Badge>
                          )
                        }

                        return (
                          <Badge variant="success">
                            <CheckCircle className="h-3 w-3 mr-1" /> Valid
                          </Badge>
                        )
                      })()}
                  </td>

                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      disabled={
                        rows.length <= 1 ||
                        row.status === 'success' ||
                        isPending
                      }
                      className="rounded p-1 text-ink-muted hover:text-error hover:bg-error-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div ref={tableEndRef} />
      </div>

      {!submitted && (
        <p className="text-xs text-ink-muted text-center mt-3">
          Fields marked <span className="text-error">*</span> are required.
        </p>
      )}
    </Modal>
  )
}
