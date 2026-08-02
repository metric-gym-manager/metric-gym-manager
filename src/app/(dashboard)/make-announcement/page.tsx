'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  CardHeader,
  CardLabel,
  CardBody,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Label,
  Select,
  Textarea,
  HelperText,
  type BadgeProps,
} from '@/components/ui'
import { PageHeader } from '@/components/common/composites'
import AnnouncementProgress from '@/features/announcements/components/AnnouncementProgress'
import { FeatureGate } from '@/features/subscriptions'
import type { Announcement } from '@/features/announcements/types'

const MAX_MESSAGE_LENGTH = 160

type Audience = 'all' | 'active' | 'expired'

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'all', label: 'All members (Active & Expired)' },
  { value: 'active', label: 'Active members only' },
  { value: 'expired', label: 'Expired members only' },
]

/**
 * Per-broadcast delivery status → badge. Uses the persisted status +
 * failed_count on the announcement row (surfaced via the Announcement type),
 * so the log shows a true DELIVERED / PARTIAL / FAILED history rather than a
 * flat "SENT".
 */
function deliveryBadge(a: Announcement): {
  variant: BadgeProps['variant']
  label: string
} {
  switch (a.status) {
    case 'completed':
      return a.failed_count > 0
        ? { variant: 'warning', label: 'PARTIAL' }
        : { variant: 'success', label: 'DELIVERED' }
    case 'sending':
      return { variant: 'accent', label: 'SENDING' }
    case 'failed':
      return { variant: 'error', label: 'FAILED' }
    case 'pending':
    default:
      return { variant: 'neutral', label: 'PENDING' }
  }
}

export default function MakeAnnouncementPage() {
  // Announcements are enabled on every paid tier — the gate passes today but
  // stays wired (server authority: POST /api/announcements returns 403 when
  // restricted).
  return (
    <FeatureGate
      feature="announcements"
      featureLabel="Announcements"
      description="Send bulk SMS announcements to all of your members at once."
    >
      <AnnouncementComposer />
    </FeatureGate>
  )
}

function AnnouncementComposer() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [confirming, setConfirming] = useState(false)
  const [currentAnnouncementId, setCurrentAnnouncementId] = useState<
    string | null
  >(null)

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await fetch('/api/announcements')
      if (!response.ok) throw new Error('Failed to fetch announcements')
      const result = await response.json()
      return result.data
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (payload: { message: string; audience: Audience }) => {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send announcement')
      }
      return response.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setMessage('')
      setConfirming(false)
      setCurrentAnnouncementId(result.data.announcement.id)
    },
  })

  const len = message.length
  const segments = Math.max(1, Math.ceil(len / MAX_MESSAGE_LENGTH))
  const isOverLimit = len > MAX_MESSAGE_LENGTH
  const trimmed = message.trim().length > 0

  const handleSend = () => {
    if (!trimmed || isOverLimit) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    sendMutation.mutate({ message, audience })
  }

  const confirmAudienceWord = AUDIENCE_OPTIONS.find((o) => o.value === audience)
    ?.label.split(' ')[0]
    .toLowerCase()

  return (
    <div className="flex max-w-app flex-col gap-4">
      <PageHeader title="Announcements" />

      {currentAnnouncementId && (
        <AnnouncementProgress
          announcementId={currentAnnouncementId}
          onComplete={() =>
            queryClient.invalidateQueries({ queryKey: ['announcements'] })
          }
          onDismiss={() => setCurrentAnnouncementId(null)}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
        {/* Compose */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardLabel>Compose broadcast</CardLabel>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audience">Audience</Label>
              <Select
                id="audience"
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value as Audience)
                  setConfirming(false)
                }}
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setConfirming(false)
                }}
                placeholder="SMS body — Sinhala, Tamil and English supported"
                rows={5}
                maxLength={MAX_MESSAGE_LENGTH}
                error={isOverLimit}
              />
            </div>
            <HelperText tone={isOverLimit ? 'error' : 'muted'}>
              {len}/{MAX_MESSAGE_LENGTH} · {segments} segment(s)
            </HelperText>
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={!trimmed || isOverLimit}
              loading={sendMutation.isPending}
            >
              {confirming
                ? `Confirm — send to ${confirmAudienceWord} members`
                : 'Send broadcast'}
            </Button>
            {confirming && !sendMutation.isPending && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            )}
            {sendMutation.isError && (
              <p className="text-body-sm text-error">
                {sendMutation.error instanceof Error
                  ? sendMutation.error.message
                  : 'Failed to send announcement'}
              </p>
            )}
          </CardBody>
        </Card>

        {/* Delivery log */}
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <CardLabel>Delivery log</CardLabel>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead numeric>Delivered</TableHead>
                  <TableHead numeric>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-6 text-center text-ink-muted"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  (!announcements || announcements.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-6 text-center text-ink-muted"
                      >
                        No announcements sent yet.
                      </TableCell>
                    </TableRow>
                  )}
                {announcements?.map((a) => {
                  const badge = deliveryBadge(a)
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-xs truncate text-ink-secondary">
                        {a.message}
                      </TableCell>
                      <TableCell className="font-mono text-mono-sm text-ink-muted">
                        {new Date(a.sent_at).toLocaleDateString('en-CA')}
                      </TableCell>
                      <TableCell numeric>
                        <span className="text-ink">
                          {a.sent_count}/{a.recipient_count}
                        </span>
                        {a.failed_count > 0 && (
                          <span className="ml-2 text-error">
                            {a.failed_count} failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell numeric>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
