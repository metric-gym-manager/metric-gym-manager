'use client'

import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, ImageIcon, Trash2, BadgeCheck } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import MemberAvatar from './MemberAvatar'
import {
  uploadMemberPhoto,
  removeMemberPhoto,
} from '@/features/members/services/photo-upload'
import { cn } from '@/lib/utils'
import type { MemberWithDiscount } from '@/features/members/types'

interface MemberPhotoSectionProps {
  member: MemberWithDiscount
  /**
   * Layout class from the caller. Exists so `MemberDetailModal` can order this
   * block on a phone without wrapping it in a div — a wrapper would be an
   * extra child of the detail's `space-y-6`/`gap-6` column and would show up
   * as a stray 24 px gap.
   */
  className?: string
}

/**
 * Member photo + verification block for the detail modals.
 *
 * - Shows the face photo (initials fallback) with add/replace/remove actions.
 *   Uploads go straight to R2 via the presigned URL pipeline.
 * - QR self-registrations that haven't been verified yet show a NEW badge
 *   and a one-tap "Verify" action that clears it.
 */
export default function MemberPhotoSection({
  member,
  className,
}: MemberPhotoSectionProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const isNew = member.registration_source === 'qr' && !member.verified_at

  const invalidateMember = () => {
    queryClient.invalidateQueries({ queryKey: ['members'] })
    queryClient.invalidateQueries({ queryKey: ['member-detail', member.id] })
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadMemberPhoto(member.id, file),
    onSuccess: () => {
      invalidateMember()
      toast.success('Photo saved')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload photo'
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => removeMemberPhoto(member.id),
    onSuccess: () => {
      invalidateMember()
      toast.success('Photo removed')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove photo'
      )
    },
  })

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/members/${member.id}/verify`, {
        method: 'POST',
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error?.message || 'Failed to verify member')
      }
      return result
    },
    onSuccess: () => {
      invalidateMember()
      toast.success('Registration verified')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to verify member'
      )
    },
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so picking the same file again re-triggers onChange
    event.target.value = ''
    if (file) {
      uploadMutation.mutate(file)
    }
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <MemberAvatar
        name={member.name}
        photoPath={member.photo_path}
        photoUpdatedAt={member.photo_updated_at}
        className="h-20 w-20 text-xl"
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Gallery / file-picker input — no capture attribute so it opens the OS file picker or photo library */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {/* Camera input — capture="environment" opens the rear camera directly on mobile */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={uploadMutation.isPending}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1.5" />
            {uploadMutation.isPending ? 'Uploading...' : 'Take Photo'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4 mr-1.5" />
            {member.photo_path ? 'Replace Photo' : 'Choose File'}
          </Button>
          {member.photo_path && (
            <Button
              size="sm"
              variant="destructive-ghost"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {removeMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          )}
        </div>

        {isNew && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">NEW</Badge>
            <span className="text-xs text-ink-muted">
              Self-registered via QR code
            </span>
            <Button
              size="sm"
              variant="success-ghost"
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate()}
            >
              <BadgeCheck className="h-4 w-4 mr-1.5" />
              {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
