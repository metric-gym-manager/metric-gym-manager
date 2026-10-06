import type { AnnouncementKind } from '../config/AnnouncementConfig'

/**
 * Where an announcement stands.
 * - `pending`: claimed, not yet scheduled — or interrupted (see
 *   `STALE_CLAIM_MINUTES`);
 * - `scheduled`: the broadcast waits out the hold;
 * - `sent` / `canceled`: what Resend says happened to it;
 * - `skipped`: a release with nothing in it a gym would care about.
 */
export type AnnouncementStatus =
  'pending' | 'scheduled' | 'sent' | 'canceled' | 'skipped'

export interface AnnouncementRecord {
  kind: AnnouncementKind
  /** The version (`1.2.0`) or the policy change (`privacy@2026-10-06`). */
  ref: string
  status: AnnouncementStatus
  broadcastId: string | null
  previewBroadcastId: string | null
  scheduledFor: string | null
  error: string | null
  updatedAt: string
}

export type AnnouncementPatch = Partial<
  Pick<
    AnnouncementRecord,
    'status' | 'broadcastId' | 'previewBroadcastId' | 'scheduledFor' | 'error'
  >
>

/**
 * The record of what has been announced: the guard against sending twice.
 * One row per `(kind, ref)`, enforced by a unique constraint, written BEFORE
 * anything reaches Resend.
 */
export interface IAnnouncementLog {
  /** Insert a `pending` row. False when one exists: someone else has it. */
  claim(kind: AnnouncementKind, ref: string): Promise<boolean>
  find(kind: AnnouncementKind, ref: string): Promise<AnnouncementRecord | null>
  /** Throws when no row changed: a no-op must not pass for a write. */
  update(
    kind: AnnouncementKind,
    ref: string,
    patch: AnnouncementPatch
  ): Promise<void>
  /** Remove a claim that sent nothing, so the next run tries again. */
  release(kind: AnnouncementKind, ref: string): Promise<void>
  listByStatus(status: AnnouncementStatus): Promise<AnnouncementRecord[]>
  /**
   * The newest release version that is settled (any status but `pending`),
   * `null` before the first. A pending claim is not an announcement: counting
   * it would leave an interrupted send unfinishable.
   */
  lastReleaseVersion(): Promise<string | null>
}
