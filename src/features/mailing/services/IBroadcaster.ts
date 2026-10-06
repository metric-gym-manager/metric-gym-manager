import type { TemplateVariableDef } from '../utils/renderTemplate'

/** A Resend template, as the pipeline needs it. */
export interface AnnouncementTemplate {
  subject: string | null
  html: string
  published: boolean
  variables: TemplateVariableDef[]
}

export interface NewBroadcast {
  /** Deterministic (`release-1.2.0`): how an interrupted run finds it again. */
  name: string
  segmentId: string
  /** `null` sends to the whole segment, whatever each person chose. */
  topicId: string | null
  subject: string
  html: string
  /** ISO time; `null` sends now. */
  scheduledAt: string | null
}

/** What became of a scheduled broadcast. */
export type BroadcastState = 'scheduled' | 'sent' | 'canceled' | 'unknown'

/** Templates in, broadcasts out: the slice of Resend announcements use. */
export interface IBroadcaster {
  /** `null` when no template has this alias. */
  getTemplate(alias: string): Promise<AnnouncementTemplate | null>
  /** Throws on any failure; the caller treats the outcome as unknown. */
  createBroadcast(broadcast: NewBroadcast): Promise<{ id: string }>
  findBroadcastByName(
    name: string
  ): Promise<{ id: string; scheduledAt: string | null } | null>
  getBroadcastState(id: string): Promise<BroadcastState>
  /** Contacts in a segment who can receive mail (not unsubscribed). */
  reachableContacts(segmentId: string): Promise<number>
}
