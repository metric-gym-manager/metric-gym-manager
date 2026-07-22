'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Panel,
  PanelHead,
  StatusBadge,
} from '@/components/workspace/primitives'
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

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 1200 }}>
      <h1 className="mws-h1">Announcements</h1>

      {currentAnnouncementId && (
        <AnnouncementProgress
          announcementId={currentAnnouncementId}
          onComplete={() =>
            queryClient.invalidateQueries({ queryKey: ['announcements'] })
          }
          onDismiss={() => setCurrentAnnouncementId(null)}
        />
      )}

      <div
        className="mws-two-col"
        style={{
          display: 'grid',
          gridTemplateColumns: '440px 1fr',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {/* Compose */}
        <Panel>
          <PanelHead label="Compose broadcast" />
          <div style={{ padding: 16 }} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="mws-label">Audience</label>
              <select
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value as Audience)
                  setConfirming(false)
                }}
                className="mws-select"
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="mws-label">Message</label>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setConfirming(false)
                }}
                placeholder="SMS body — Sinhala, Tamil and English supported"
                rows={5}
                maxLength={MAX_MESSAGE_LENGTH}
                className="mws-textarea"
              />
            </div>
            <div
              className="flex justify-between mws-mono"
              style={{
                fontSize: 11,
                color: isOverLimit ? 'var(--mws-err)' : 'var(--mws-t3)',
              }}
            >
              <span>
                {len}/{MAX_MESSAGE_LENGTH} · {segments} segment(s)
              </span>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!trimmed || isOverLimit || sendMutation.isPending}
              className="mws-btn mws-btn-primary"
              style={{ height: 32 }}
            >
              {sendMutation.isPending
                ? 'Queuing…'
                : confirming
                  ? `Confirm — send to ${AUDIENCE_OPTIONS.find(
                      (o) => o.value === audience
                    )
                      ?.label.split(' ')[0]
                      .toLowerCase()} members`
                  : 'Send broadcast'}
            </button>
            {confirming && !sendMutation.isPending && (
              <button
                type="button"
                className="mws-btn mws-btn-sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            )}
            {sendMutation.isError && (
              <p style={{ fontSize: 12, color: 'var(--mws-err)' }}>
                {sendMutation.error instanceof Error
                  ? sendMutation.error.message
                  : 'Failed to send announcement'}
              </p>
            )}
          </div>
        </Panel>

        {/* Delivery log */}
        <Panel style={{ overflow: 'hidden' }}>
          <PanelHead label="Delivery log" />
          <div className="mws-table-scroll">
            <table className="mws-table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Sent</th>
                  <th style={{ textAlign: 'right' }}>Recipients</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        color: 'var(--mws-t3)',
                      }}
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  (!announcements || announcements.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: 24,
                          textAlign: 'center',
                          color: 'var(--mws-t3)',
                        }}
                      >
                        No announcements sent yet.
                      </td>
                    </tr>
                  )}
                {announcements?.map((a) => (
                  <tr key={a.id}>
                    <td
                      style={{
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--mws-t2)',
                      }}
                    >
                      {a.message}
                    </td>
                    <td
                      className="mws-mono"
                      style={{ fontSize: 12, color: 'var(--mws-t3)' }}
                    >
                      {new Date(a.sent_at).toLocaleDateString('en-CA')}
                    </td>
                    <td className="mws-num" style={{ color: 'var(--mws-t2)' }}>
                      {a.recipient_count}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <StatusBadge tone="ok">SENT</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
