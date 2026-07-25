'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Panel, PanelHead } from '@/components/workspace/primitives'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
        <h1 className="mws-h1">Rules &amp; Terms</h1>
        <p className="mws-row-sub" style={{ marginTop: 4 }}>
          Your gym&apos;s rules and terms of service. Members agree to these
          when they register.
        </p>
      </div>

      <Panel>
        <PanelHead
          label="Gym Rules & Guidelines"
          right={
            <button
              type="button"
              className="mws-mono"
              style={{
                fontSize: 11,
                color: 'var(--mws-t3)',
                cursor: 'pointer',
              }}
              onClick={() => setRules(DEFAULT_GYM_RULES)}
            >
              RESET TO DEFAULT
            </button>
          }
        />
        <div style={{ padding: 16 }}>
          <Textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={16}
            className="font-mono text-sm"
            placeholder="Enter your gym rules and guidelines"
          />
        </div>
      </Panel>

      <Panel>
        <PanelHead
          label="Terms of Service"
          right={
            <button
              type="button"
              className="mws-mono"
              style={{
                fontSize: 11,
                color: 'var(--mws-t3)',
                cursor: 'pointer',
              }}
              onClick={() => setTerms(DEFAULT_GYM_TERMS)}
            >
              RESET TO DEFAULT
            </button>
          }
        />
        <div style={{ padding: 16 }}>
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={16}
            className="font-mono text-sm"
            placeholder="Enter your terms of service"
          />
        </div>
      </Panel>

      <div>
        <Button
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
