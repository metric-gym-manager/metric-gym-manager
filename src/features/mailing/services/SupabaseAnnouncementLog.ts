import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnnouncementKind } from '../config/AnnouncementConfig'
import { compareVersions } from '../utils/changelog'
import type {
  AnnouncementPatch,
  AnnouncementRecord,
  AnnouncementStatus,
  IAnnouncementLog,
} from './IAnnouncementLog'

const TABLE = 'mailing_announcements'
const COLUMNS =
  'kind, ref, status, broadcast_id, preview_broadcast_id, scheduled_for, error, updated_at'
const UNIQUE_VIOLATION = '23505'

interface Row {
  kind: AnnouncementKind
  ref: string
  status: AnnouncementStatus
  broadcast_id: string | null
  preview_broadcast_id: string | null
  scheduled_for: string | null
  error: string | null
  updated_at: string
}

function toRecord(row: Row): AnnouncementRecord {
  return {
    kind: row.kind,
    ref: row.ref,
    status: row.status,
    broadcastId: row.broadcast_id,
    previewBroadcastId: row.preview_broadcast_id,
    scheduledFor: row.scheduled_for,
    error: row.error,
    updatedAt: row.updated_at,
  }
}

/**
 * The announcement log in `mailing_announcements`. Needs the SERVICE-ROLE
 * client: the table has RLS on and no policies, so the session client would be
 * refused every row — and a refused update reports success while changing
 * nothing, which is why every write here selects back what it wrote (the
 * rule 2.7 lesson).
 */
export class SupabaseAnnouncementLog implements IAnnouncementLog {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async claim(kind: AnnouncementKind, ref: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .insert({ kind, ref, status: 'pending' })
      .select('id')
    if (error?.code === UNIQUE_VIOLATION) return false
    if (error) throw new Error(error.message)
    if (!data || data.length !== 1) {
      throw new Error(`Claim for ${kind} ${ref} wrote no row`)
    }
    return true
  }

  async find(
    kind: AnnouncementKind,
    ref: string
  ): Promise<AnnouncementRecord | null> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('kind', kind)
      .eq('ref', ref)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toRecord(data as Row) : null
  }

  async update(
    kind: AnnouncementKind,
    ref: string,
    patch: AnnouncementPatch
  ): Promise<void> {
    const values: Record<string, unknown> = {}
    if (patch.status !== undefined) values.status = patch.status
    if (patch.broadcastId !== undefined) values.broadcast_id = patch.broadcastId
    if (patch.previewBroadcastId !== undefined) {
      values.preview_broadcast_id = patch.previewBroadcastId
    }
    if (patch.scheduledFor !== undefined) {
      values.scheduled_for = patch.scheduledFor
    }
    if (patch.error !== undefined) values.error = patch.error
    values.updated_at = this.clock().toISOString()

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(values)
      .eq('kind', kind)
      .eq('ref', ref)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      throw new Error(`No announcement ${kind} ${ref} to update`)
    }
  }

  async release(kind: AnnouncementKind, ref: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLE)
      .delete()
      .eq('kind', kind)
      .eq('ref', ref)
      .eq('status', 'pending')
      .select('id')
    if (error) throw new Error(error.message)
  }

  async listByStatus(
    status: AnnouncementStatus
  ): Promise<AnnouncementRecord[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('status', status)
    if (error) throw new Error(error.message)
    return ((data ?? []) as Row[]).map(toRecord)
  }

  async lastReleaseVersion(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('ref')
      .eq('kind', 'release')
      .neq('status', 'pending')
    if (error) throw new Error(error.message)
    const versions = ((data ?? []) as { ref: string }[])
      .map((row) => row.ref)
      .sort(compareVersions)
    return versions[versions.length - 1] ?? null
  }
}
