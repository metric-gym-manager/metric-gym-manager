'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SectionHeader } from '@/components/common/composites'
import { Button, Textarea } from '@/components/ui'
import type { GymPolicies } from '@/features/settings/types'
import {
  DEFAULT_GYM_RULES,
  DEFAULT_GYM_TERMS,
} from '@/features/settings/config/defaultGymPolicies'

/**
 * Settings → Rules & Terms — App Workspace design.
 *
 * Per-gym editable Gym Rules and Terms of Service documents, pre-seeded with a
 * default. The Gym Rules document is what the registration forms' "I agree to
 * the gym's guidelines & rules" checkbox links to.
 */
export default function GymPoliciesPage() {
  const queryClient = useQueryClient()
  // Local edits overlay the fetched documents; no setState-in-effect needed.
  const [draft, setDraft] = useState<GymPolicies | null>(null)

  const { data } = useQuery<GymPolicies>({
    queryKey: ['gym-policies'],
    queryFn: async () => {
      const response = await fetch('/api/settings/policies')
      if (!response.ok) throw new Error('Failed to fetch policies')
      const result = await response.json()
      return result.data as GymPolicies
    },
  })

  const current: GymPolicies = draft ?? data ?? { gym_rules: '', gym_terms: '' }
  const rules = current.gym_rules
  const terms = current.gym_terms
  const setRules = (value: string) => setDraft({ ...current, gym_rules: value })
  const setTerms = (value: string) => setDraft({ ...current, gym_terms: value })

  const saveMutation = useMutation({
    mutationFn: async (payload: GymPolicies) => {
      const response = await fetch('/api/settings/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message || 'Failed to save')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-policies'] })
      toast.success('Rules & terms saved')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save')
    },
  })

  const handleSave = () => {
    saveMutation.mutate({ gym_rules: rules, gym_terms: terms })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-h1 text-ink">Rules &amp; Terms</h1>
        <p className="mt-1 text-caption text-ink-muted">
          Your gym&apos;s rules and terms of service. Members agree to these
          when they register.
        </p>
      </div>

      <section>
        <SectionHeader
          variant="metadata"
          divider
          title="Gym Rules & Guidelines"
          actions={
            <Button
              variant="link"
              size="xs"
              onClick={() => setRules(DEFAULT_GYM_RULES)}
            >
              Reset to default
            </Button>
          }
        />
        <div className="pt-3">
          <Textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={16}
            className="font-mono"
            placeholder="Enter your gym rules and guidelines"
          />
        </div>
      </section>

      <section>
        <SectionHeader
          variant="metadata"
          divider
          title="Terms of Service"
          actions={
            <Button
              variant="link"
              size="xs"
              onClick={() => setTerms(DEFAULT_GYM_TERMS)}
            >
              Reset to default
            </Button>
          }
        />
        <div className="pt-3">
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={16}
            className="font-mono"
            placeholder="Enter your terms of service"
          />
        </div>
      </section>

      <div>
        <Button
          variant="accent"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          size="sm"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
