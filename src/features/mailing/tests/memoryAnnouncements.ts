import type { AnnouncementKind } from '../config/AnnouncementConfig'
import type {
  AnnouncementPatch,
  AnnouncementRecord,
  AnnouncementStatus,
  IAnnouncementLog,
} from '../services/IAnnouncementLog'
import type {
  AnnouncementTemplate,
  BroadcastState,
  IBroadcaster,
  NewBroadcast,
} from '../services/IBroadcaster'
import { compareVersions } from '../utils/changelog'

/**
 * The announcement log in memory, with the one property that matters: a
 * second claim on the same `(kind, ref)` fails, as the unique constraint makes
 * it fail in Postgres.
 */
export class MemoryAnnouncementLog implements IAnnouncementLog {
  readonly rows = new Map<string, AnnouncementRecord>()
  constructor(private readonly clock: () => Date = () => new Date()) {}

  private key(kind: AnnouncementKind, ref: string) {
    return `${kind}:${ref}`
  }

  seed(record: Omit<AnnouncementRecord, 'updatedAt'> & { updatedAt?: string }) {
    this.rows.set(this.key(record.kind, record.ref), {
      ...record,
      updatedAt: record.updatedAt ?? this.clock().toISOString(),
    })
  }

  async claim(kind: AnnouncementKind, ref: string): Promise<boolean> {
    const key = this.key(kind, ref)
    if (this.rows.has(key)) return false
    this.rows.set(key, {
      kind,
      ref,
      status: 'pending',
      broadcastId: null,
      previewBroadcastId: null,
      scheduledFor: null,
      error: null,
      updatedAt: this.clock().toISOString(),
    })
    return true
  }

  async find(kind: AnnouncementKind, ref: string) {
    return this.rows.get(this.key(kind, ref)) ?? null
  }

  async update(kind: AnnouncementKind, ref: string, patch: AnnouncementPatch) {
    const row = this.rows.get(this.key(kind, ref))
    if (!row) throw new Error(`No announcement ${kind} ${ref}`)
    Object.assign(row, patch, { updatedAt: this.clock().toISOString() })
  }

  async release(kind: AnnouncementKind, ref: string) {
    this.rows.delete(this.key(kind, ref))
  }

  async listByStatus(status: AnnouncementStatus) {
    return [...this.rows.values()].filter((row) => row.status === status)
  }

  async lastReleaseVersion() {
    const versions = [...this.rows.values()]
      .filter((row) => row.kind === 'release' && row.status !== 'pending')
      .map((row) => row.ref)
      .sort(compareVersions)
    return versions[versions.length - 1] ?? null
  }
}

/** Resend's templates and broadcasts in memory, with switchable failures. */
export class FakeBroadcaster implements IBroadcaster {
  readonly templates = new Map<string, AnnouncementTemplate>()
  readonly created: (NewBroadcast & { id: string })[] = []
  readonly states = new Map<string, BroadcastState>()
  readonly stateReads: string[] = []
  failPreview = false
  failReal = false

  async getTemplate(alias: string) {
    return this.templates.get(alias) ?? null
  }

  async createBroadcast(broadcast: NewBroadcast) {
    const isPreview = broadcast.name.endsWith('-preview')
    if ((isPreview && this.failPreview) || (!isPreview && this.failReal)) {
      throw new Error('Resend request timed out')
    }
    const id = `bc_${this.created.length + 1}`
    this.created.push({ ...broadcast, id })
    return { id }
  }

  async findBroadcastByName(name: string) {
    const found = this.created.find((b) => b.name === name)
    return found ? { id: found.id, scheduledAt: found.scheduledAt } : null
  }

  async getBroadcastState(id: string) {
    this.stateReads.push(id)
    return this.states.get(id) ?? 'scheduled'
  }

  previews() {
    return this.created.filter((b) => b.name.endsWith('-preview'))
  }

  real() {
    return this.created.filter((b) => !b.name.endsWith('-preview'))
  }
}
