'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, Button, Input, Label, Checkbox } from '@/components/ui'
import type { AdmissionFeeSettings } from '@/features/settings/types'

/**
 * Membership Setup → Admission Fee.
 *
 * A one-time admission/registration fee charged on the member's first payment.
 * When "enable admission fee" is ticked the fee is shown on the public QR
 * self-registration form and added to the amount due; the charged amount is
 * always resolved server-side.
 */
export default function AdmissionFeeTab() {
  const queryClient = useQueryClient()
  // Local edits overlay the fetched value; no setState-in-effect needed.
  const [draft, setDraft] = useState<AdmissionFeeSettings | null>(null)

  const { data, isLoading } = useQuery<AdmissionFeeSettings>({
    queryKey: ['billing-setup-admission-fee'],
    queryFn: async () => {
      const response = await fetch('/api/billing-setup/admission-fee')
      if (!response.ok) throw new Error('Failed to fetch admission fee')
      const result = await response.json()
      return result.data as AdmissionFeeSettings
    },
  })

  const current: AdmissionFeeSettings = draft ??
    data ?? { admission_fee: 0, admission_fee_enabled: false }
  const amount = current.admission_fee
  const enabled = current.admission_fee_enabled
  const setAmount = (value: number) =>
    setDraft({ ...current, admission_fee: value })
  const setEnabled = (value: boolean) =>
    setDraft({ ...current, admission_fee_enabled: value })

  const saveMutation = useMutation({
    mutationFn: async (payload: AdmissionFeeSettings) => {
      const response = await fetch('/api/billing-setup/admission-fee', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(
          body?.error?.message || 'Failed to update admission fee'
        )
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['billing-setup-admission-fee'],
      })
      toast.success('Admission fee saved')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save')
    },
  })

  const handleSave = () => {
    if (enabled && amount <= 0) {
      toast.error('Enter an admission fee greater than 0, or disable it')
      return
    }
    saveMutation.mutate({
      admission_fee: amount,
      admission_fee_enabled: enabled,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Admission Fee</h2>
        <p className="text-sm text-ink-muted mt-1">
          A one-time registration fee added to a member&apos;s first payment.
        </p>
      </div>

      <Card className="p-6 space-y-5 max-w-md">
        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading...</p>
        ) : (
          <>
            {/* Checkbox and its text sit in two flex items so the copy wraps as
                one column. (The DS `Label` is itself a flex row, so nesting the
                description inside it made each run a sibling flex item and
                shattered the text across narrow columns.) */}
            {/* The `<label>` WRAPS the control, rather than pointing at it
                with `htmlFor` alone: `htmlFor` is an association, not a hit
                area, and §15.1 puts the 44 px on the label. A bare `Checkbox`
                is 24 px on a phone, under the probe's floor.

                Both text runs are `<span>`s, not `<p>`s: a label's content
                model is phrasing content, so a paragraph inside it is invalid.
                Tailwind's preflight zeroes paragraph margins, so the two
                render identically.

                A GRID rather than the flex row this replaced, because the
                label's own text has to be a DIRECT child — nested one level
                deeper inside a text column, `jsx-a11y/label-has-associated-
                control` reports the label as having no accessible text. The
                two columns give the same geometry: the control, then the title
                and the description stacked beside it. */}
            <label
              htmlFor="admission-fee-enabled"
              className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-2 gap-y-0.5 phone:min-h-touch"
            >
              <Checkbox
                id="admission-fee-enabled"
                className="mt-1"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="min-w-0 text-body font-medium text-ink">
                Enable admission fee
              </span>
              <span className="col-start-2 text-caption text-ink-muted">
                When enabled, the fee appears on the self-registration form and
                is added to the amount due.
              </span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="admission-fee-amount">Admission Fee (LKR)</Label>
              <Input
                id="admission-fee-amount"
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                placeholder="Enter admission fee"
                disabled={!enabled}
              />
            </div>

            <Button
              variant="accent"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              size="sm"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
