'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import { toast } from 'sonner'
import { Download, Printer, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  downloadPosterImage,
  posterFilename,
  printPosterImages,
} from '@/features/registration/utils/print-qr'

interface GymQrItem {
  gymId: string
  gymName: string
  username: string
  email: string
  token: string | null
  joinUrl: string | null
  isActive: boolean
  rotatedAt: string | null
}

/** Build the poster PNG endpoint for a gym. */
const posterUrl = (gymId: string) =>
  `/api/admin/qr-poster?gymId=${encodeURIComponent(gymId)}`

/**
 * Admin QR dashboard grid: searchable list of every gym's QR code with per-gym
 * print / download, print-all, and per-gym regeneration. Each card renders a
 * live QR preview, while Print and Download use the server-rendered "2b" poster
 * (gym logo + name + QR + Metric branding), so the printed sheet matches the
 * saved PNG exactly. "Generate New QR" rotates the gym's token, which
 * invalidates every previously printed poster for that gym.
 */
export default function QrCodesDashboardClient() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [confirmGym, setConfirmGym] = useState<GymQrItem | null>(null)

  const {
    data: gyms,
    isLoading,
    error,
  } = useQuery<GymQrItem[]>({
    queryKey: ['admin-qr-codes'],
    queryFn: async () => {
      const response = await fetch('/api/admin/qr-codes')
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Failed to load QR codes')
      }
      return result.data
    },
    staleTime: 300000,
  })

  const regenerate = useMutation({
    mutationFn: async (gymId: string) => {
      const response = await fetch('/api/admin/qr-codes/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Failed to regenerate QR code')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-qr-codes'] })
      toast.success(
        'New QR code generated. Previously printed posters no longer work.'
      )
    },
    onError: () => {
      toast.error('Could not generate a new QR code. Please try again.')
    },
    onSettled: () => {
      setConfirmGym(null)
    },
  })

  const filtered = useMemo(() => {
    const items = (gyms ?? []).filter((gym) => gym.joinUrl)
    if (!search.trim()) return items
    const query = search.trim().toLowerCase()
    return items.filter(
      (gym) =>
        gym.gymName.toLowerCase().includes(query) ||
        gym.username.toLowerCase().includes(query) ||
        gym.email.toLowerCase().includes(query)
    )
  }, [gyms, search])

  const handlePrintOne = (gym: GymQrItem) => {
    printPosterImages([posterUrl(gym.gymId)])
  }

  const handleDownloadOne = async (gym: GymQrItem) => {
    setDownloadingId(gym.gymId)
    try {
      await downloadPosterImage(
        posterUrl(gym.gymId),
        posterFilename(gym.gymName)
      )
    } catch {
      toast.error('Could not generate the poster. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handlePrintAll = () => {
    printPosterImages(filtered.map((gym) => posterUrl(gym.gymId)))
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Failed to load QR codes. Please try again.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search gyms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handlePrintAll} disabled={filtered.length === 0}>
          <Printer className="h-4 w-4 mr-1.5" />
          Print All ({filtered.length})
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border bg-white">
          <p className="text-sm text-gray-500">No gyms found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((gym) => {
            const isRegenerating =
              regenerate.isPending && regenerate.variables === gym.gymId
            return (
              <div
                key={gym.gymId}
                className="rounded-lg border bg-white p-4 flex flex-col items-center text-center"
              >
                <h3
                  className="font-semibold text-gray-900 truncate w-full"
                  title={gym.gymName}
                >
                  {gym.gymName}
                </h3>
                <p className="text-xs text-gray-500 truncate w-full">
                  {gym.email}
                </p>

                <div className="my-4 rounded-lg border p-3">
                  <QRCodeCanvas
                    value={gym.joinUrl!}
                    size={144}
                    level="M"
                    marginSize={4}
                  />
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintOne(gym)}
                  >
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadOne(gym)}
                    disabled={downloadingId === gym.gymId}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    {downloadingId === gym.gymId ? 'Preparing…' : 'PNG'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmGym(gym)}
                    disabled={isRegenerating}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-1.5 ${isRegenerating ? 'animate-spin' : ''}`}
                    />
                    {isRegenerating ? 'Generating…' : 'New QR'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={confirmGym !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmGym(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate a new QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces {confirmGym?.gymName}&apos;s registration link with
              a new one. Any QR posters already printed or shared will stop
              working, and the gym will need to print the new code. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerate.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (confirmGym) regenerate.mutate(confirmGym.gymId)
              }}
              disabled={regenerate.isPending}
            >
              {regenerate.isPending ? 'Generating…' : 'Generate New QR'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
