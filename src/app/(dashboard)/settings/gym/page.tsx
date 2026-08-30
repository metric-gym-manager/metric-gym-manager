'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  updateGymInfoSchema,
  type UpdateGymInfoInput,
} from '@/features/settings/schemas/settings.schemas'
import { Button, Input } from '@/components/ui'
import { SettingsSection, SettingsRow } from '@/components/common/composites'
import ProfileImageUpload from '@/features/settings/components/ProfileImageUpload'
import type { GymProfile } from '@/features/auth/types'

/**
 * Settings → Gym Information — App Workspace design. Inline control rows
 * (label left / input right, hairline separated). Same react-hook-form + zod
 * validation and PATCH /api/settings/gym mutation as before.
 */
export default function GymInformationPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { data: gymProfile } = useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      const result = await response.json()
      return result.data
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateGymInfoInput>({
    resolver: zodResolver(updateGymInfoSchema),
  })

  useEffect(() => {
    if (gymProfile) {
      reset({
        gym_name: gymProfile.gym_name,
        gym_address: gymProfile.gym_address || '',
        gym_website: gymProfile.gym_website || '',
      })
    }
  }, [gymProfile, reset])

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateGymInfoInput) => {
      const response = await fetch('/api/settings/gym', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update gym information')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] })
      setSuccessMessage('Gym information updated')
      setTimeout(() => setSuccessMessage(null), 3000)
    },
  })

  const handleRegisterNewGym = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/register')
  }

  return (
    <form
      onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
      className="flex flex-col gap-3"
    >
      <SettingsSection
        title="Gym profile"
        actions={
          <Button variant="secondary" size="xs" onClick={handleRegisterNewGym}>
            Register new gym
          </Button>
        }
      >
        <SettingsRow
          label="Profile image"
          description="Appears in the workspace header and on member-facing pages"
          control={
            gymProfile ? (
              <ProfileImageUpload
                currentImageUrl={gymProfile.profile_image_url}
                gymName={gymProfile.gym_name}
              />
            ) : (
              <div className="size-24 animate-pulse rounded-full bg-surface-active" />
            )
          }
        />

        <SettingsRow
          label="Gym name"
          description="Shown on receipts and the SMS sender ID"
          control={
            <div className="w-full">
              <Input
                {...register('gym_name')}
                placeholder="Enter gym name"
                error={!!errors.gym_name}
                aria-label="Gym name"
              />
              {errors.gym_name && (
                <p className="mt-1 text-caption text-error">
                  {errors.gym_name.message}
                </p>
              )}
            </div>
          }
        />
        <SettingsRow
          label="Address"
          description="Primary location"
          control={
            <div className="w-full">
              <Input
                {...register('gym_address')}
                placeholder="Enter gym address"
                error={!!errors.gym_address}
                aria-label="Address"
              />
              {errors.gym_address && (
                <p className="mt-1 text-caption text-error">
                  {errors.gym_address.message}
                </p>
              )}
            </div>
          }
        />
        <SettingsRow
          label="Website"
          description="Optional — shown on member-facing pages"
          control={
            <div className="w-full">
              <Input
                {...register('gym_website')}
                type="url"
                placeholder="https://www.example.com"
                error={!!errors.gym_website}
                aria-label="Website"
              />
              {errors.gym_website && (
                <p className="mt-1 text-caption text-error">
                  {errors.gym_website.message}
                </p>
              )}
            </div>
          }
        />

        <div className="flex flex-col gap-2 pt-3 tablet:flex-row tablet:items-center tablet:justify-end">
          {successMessage && (
            <span className="text-caption text-success tablet:mr-auto">
              {successMessage}
            </span>
          )}
          {updateMutation.isError && (
            <span className="text-caption text-error tablet:mr-auto">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Failed to save'}
            </span>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => reset()}
              disabled={!isDirty || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </SettingsSection>
    </form>
  )
}
