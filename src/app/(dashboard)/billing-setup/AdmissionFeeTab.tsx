'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
        <p className="text-sm text-gray-500 mt-1">
          A one-time registration fee added to a member&apos;s first payment.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-5 max-w-md">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <Checkbox
                id="admission-fee-enabled"
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(!!checked)}
              />
              <Label
                htmlFor="admission-fee-enabled"
                className="text-sm font-normal leading-snug"
              >
                Enable admission fee
                <span className="block text-xs text-gray-500 mt-0.5">
                  When enabled, the fee appears on the self-registration form
                  and is added to the amount due.
                </span>
              </Label>
            </div>

            <div>
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
              onClick={handleSave}
              disabled={saveMutation.isPending}
              size="sm"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
