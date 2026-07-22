'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { PROFILE_IMAGE_WEBP_MESSAGE } from '@/features/settings/utils/profileImage'

interface ProfileImageUploadProps {
  currentImageUrl?: string | null
  gymName: string
}

export default function ProfileImageUpload({
  currentImageUrl,
  gymName,
}: ProfileImageUploadProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentImageUrl || null
  )

  // Convert image to SVG data URL
  const convertImageToSvg = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Create SVG with embedded image
          const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}">
  <image href="${e.target?.result}" width="${img.width}" height="${img.height}"/>
</svg>`

          // Convert SVG to data URL
          const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`
          resolve(svgDataUrl)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const uploadMutation = useMutation({
    mutationFn: async (svgDataUrl: string) => {
      const response = await fetch('/api/settings/gym/profile-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: svgDataUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload image')
      }

      return response.json()
    },
    onSuccess: () => {
      // Force immediate refetch of gym profile to update header
      queryClient.refetchQueries({ queryKey: ['gym-profile'] })
      setProgress(100)
      toast.success('Profile image updated successfully')
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
      }, 1000)
    },
    onError: (error) => {
      setUploading(false)
      setProgress(0)
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload image'
      )
    },
  })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Reject WebP — it cannot be rendered on the QR registration poster.
    if (
      file.type === 'image/webp' ||
      file.name.toLowerCase().endsWith('.webp')
    ) {
      toast.error(PROFILE_IMAGE_WEBP_MESSAGE)
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploading(true)
    setProgress(10)

    try {
      // Create preview
      const previewDataUrl = URL.createObjectURL(file)
      setPreviewUrl(previewDataUrl)
      setProgress(30)

      // Convert to SVG
      const svgDataUrl = await convertImageToSvg(file)
      setProgress(60)

      // Upload
      await uploadMutation.mutateAsync(svgDataUrl)
    } catch (error) {
      setUploading(false)
      setProgress(0)
      toast.error('Failed to process image')
      console.error('Image processing error:', error)
    }
  }

  const getInitials = () => {
    return gymName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-4">
      <Label>Profile Image</Label>

      <div className="flex items-center gap-6">
        {/* Profile Picture Preview */}
        <div className="relative">
          <div className="h-24 w-24 rounded-full border-2 border-gray-200 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={gymName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-white text-2xl font-bold">
                {getInitials()}
              </span>
            )}
          </div>

          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex-1 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Image
              </>
            )}
          </Button>

          {/* Upload Progress */}
          {uploading && progress < 100 && (
            <div className="space-y-1">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{progress}% complete</p>
            </div>
          )}

          {/* Success Indicator */}
          {progress === 100 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-medium">Upload complete!</p>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Recommended: Square image, at least 200x200px. Max 5MB.
          </p>
        </div>
      </div>
    </div>
  )
}
