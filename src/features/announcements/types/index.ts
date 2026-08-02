/** Lifecycle of a broadcast as it is dispatched in the background. */
export type AnnouncementStatus = 'pending' | 'sending' | 'completed' | 'failed'

export interface Announcement {
  id: string
  gym_id: string
  message: string
  recipient_count: number
  /**
   * Per-broadcast delivery aggregation, maintained by the background sender
   * (announcement.service.ts). Surfaced in the delivery log so a historical
   * "delivered N/M" + real status is shown, not just recipient counts.
   */
  status: AnnouncementStatus
  sent_count: number
  failed_count: number
  sent_at: string
  created_at: string
  updated_at: string
}
