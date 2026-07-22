'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import { toast } from 'sonner'
import { Copy, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  downloadPosterImage,
  posterFilename,
  printPosterImages,
} from '../utils/print-qr'
import type { RegistrationLink } from '../types'

interface RegistrationQRCardProps {
  gymName: string
}

/** API endpoint that renders this gym's 2b registration poster as a PNG. */
const POSTER_URL = '/api/settings/qr-poster'

/**
 * Gym settings card for the member self-registration QR code.
 *
 * Shows a live QR preview + join link. Download and Print use the
 * server-rendered "2b" poster (gym logo + name + QR + Metric branding) so the
 * saved PNG and the printed sheet are identical.
 */
export default function RegistrationQRCard({
  gymName,
}: RegistrationQRCardProps) {
  const [isPreparing, setIsPreparing] = useState(false)

  const { data: link, isLoading } = useQuery<RegistrationLink>({
    queryKey: ['registration-link'],
    queryFn: async () => {
      const response = await fetch('/api/settings/registration-link')
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(
          result?.error?.message || 'Failed to load registration link'
        )
      }
      return result.data
    },
    staleTime: 300000,
  })

  const handleCopy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link.joinUrl)
    toast.success('Link copied')
  }

  const handleDownload = async () => {
    setIsPreparing(true)
    try {
      await downloadPosterImage(POSTER_URL, posterFilename(gymName))
    } catch {
      toast.error('Could not generate the poster. Please try again.')
    } finally {
      setIsPreparing(false)
    }
  }

  const handlePrint = () => {
    printPosterImages([POSTER_URL])
  }

  if (isLoading || !link) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="h-48 animate-pulse rounded bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Member Self-Registration QR</h3>
        <p className="mt-1 text-sm text-gray-500">
          Print this QR code and place it at the front desk. New members scan
          it, fill in their details with a selfie, and appear in your members
          list with a NEW badge — you just collect the cash.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="rounded-xl border p-4 bg-white">
          <QRCodeCanvas
            value={link.joinUrl}
            size={192}
            level="M"
            marginSize={4}
          />
        </div>

        <div className="flex-1 space-y-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 break-all">
            {link.joinUrl}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1.5" /> Copy Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={isPreparing}
            >
              <Download className="h-4 w-4 mr-1.5" />
              {isPreparing ? 'Preparing…' : 'Download PNG'}
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Download and Print produce a full poster with your gym logo, name
            and Metric Gym OS branding.
          </p>
        </div>
      </div>
    </div>
  )
}
