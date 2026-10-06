import type { LegalChange } from '@/features/marketing/config/legalChanges'
import {
  ANNOUNCEMENT_DEFAULT_SUBJECT,
  ANNOUNCEMENT_HOLD_HOURS,
  ANNOUNCEMENT_TEMPLATE_ALIAS,
  ANNOUNCEMENT_TIME_ZONE,
  AnnouncementKind,
  CHANGE_CATEGORY_ORDER,
  STALE_CLAIM_MINUTES,
} from '../config/AnnouncementConfig'
import {
  MailingAudience,
  MailingTopic,
  RESEND_SEGMENT_IDS,
  RESEND_TEST_SEGMENT_ID,
  RESEND_TOPIC_IDS,
} from '../config/MailingConfig'
import {
  policyVariables,
  previewBanner,
  releaseVariables,
} from '../utils/announcementContent'
import {
  compareVersions,
  parseChangelog,
  selectReleases,
  type ReleaseSection,
} from '../utils/changelog'
import { renderTemplate, withPreviewBanner } from '../utils/renderTemplate'
import type { IAnnouncementLog } from './IAnnouncementLog'
import type { IBroadcaster } from './IBroadcaster'

export interface SendAnnouncementsInput {
  /** The version running in production (`APP_VERSION`). */
  appVersion: string
  /** The text of CHANGELOG.md, as deployed with that version. */
  changelog: string
  /** `LEGAL_CHANGES`, from the marketing feature. */
  legalChanges: readonly LegalChange[]
  now: Date
  /** Render and report; claim, preview and send nothing. */
  dryRun?: boolean
  /** A trial: the "real" broadcast goes to the Test segment as well. */
  testOnly?: boolean
}

export type AnnouncementOutcome =
  | 'no_release'
  | 'already_announced'
  | 'in_progress'
  | 'template_not_ready'
  | 'render_failed'
  | 'preview_failed'
  | 'send_failed'
  | 'scheduled'
  | 'reconciled'
  | 'skipped'
  | 'would_send'
  | 'would_skip'
  | 'refreshed'
  | 'refresh_failed'

export interface AnnouncementReportEntry {
  kind: AnnouncementKind
  ref: string
  outcome: AnnouncementOutcome
  detail?: string
  scheduledFor?: string
  /** Dry run only: what would be sent. */
  subject?: string
  html?: string
}

interface Candidate {
  kind: AnnouncementKind
  ref: string
  /** The broadcast's name in Resend: deterministic, so a lost run can find it. */
  name: string
  topicId: string | null
  variables: Record<string, string | number>
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** `YYYY-MM-DD` in Sri Lanka. */
function dayIn(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANNOUNCEMENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** A subject is plain text: undo the escaping the values were given for HTML. */
function asSubject(rendered: string): string {
  return rendered
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Turns a deployed release and a changed legal page into an email to the
 * gyms (docs/architecture/marketing-email.md, "Announcements").
 *
 * For each thing to announce, in this order — each step can stop it:
 * 1. the log is checked: announced already, or claimed by a run in progress;
 * 2. the Resend template is fetched by alias and must be published;
 * 3. it is filled; any placeholder left without a value stops it;
 * 4. a row is CLAIMED (unique per kind and ref), before Resend sees anything;
 * 5. a preview goes to the Test segment now;
 * 6. the real broadcast is scheduled `ANNOUNCEMENT_HOLD_HOURS` later — the
 *    owner's window to cancel it.
 *
 * A failure before step 4 leaves no trace, so the next run tries again. A
 * failed preview releases the claim: nothing reaches a gym unseen. A failed
 * real send is AMBIGUOUS (Resend may have created it before the timeout), so
 * the claim stays; once stale it is reconciled by broadcast name, and only
 * created again if Resend has no such broadcast.
 *
 * Releases go with the Updates topic, so an opt-out is honoured. Policy
 * notices go with no topic, to every gym with a current subscription (owner
 * decision, 2026-10-06); the mail app's own unsubscribe still stops them.
 */
export class SendAnnouncements {
  constructor(
    private readonly log: IAnnouncementLog,
    private readonly broadcaster: IBroadcaster
  ) {}

  /**
   * @param input - What is deployed, and when
   * @returns One entry per announcement looked at, plus each scheduled send
   *   whose outcome was refreshed from Resend
   */
  async execute(
    input: SendAnnouncementsInput
  ): Promise<AnnouncementReportEntry[]> {
    const report: AnnouncementReportEntry[] = []
    if (!input.dryRun) report.push(...(await this.refreshScheduled(input.now)))
    report.push(await this.announceRelease(input))
    for (const candidate of this.policyCandidates(input)) {
      report.push(await this.announce(candidate, input))
    }
    return report
  }

  private async announceRelease(
    input: SendAnnouncementsInput
  ): Promise<AnnouncementReportEntry> {
    const kind = AnnouncementKind.Release
    const sections = parseChangelog(input.changelog)
    const lastAnnounced = await this.log.lastReleaseVersion()
    const releases = selectReleases(sections, {
      deployed: input.appVersion,
      lastAnnounced,
    })
    const [newest] = releases
    if (!newest) return { kind, ref: input.appVersion, outcome: 'no_release' }

    const ref = newest.version
    const hasChanges = releases.some((release) =>
      CHANGE_CATEGORY_ORDER.some((c) => release.changes[c].length > 0)
    )
    if (!hasChanges) {
      if (input.dryRun) return { kind, ref, outcome: 'would_skip' }
      if (!(await this.log.claim(kind, ref))) {
        return { kind, ref, outcome: 'in_progress' }
      }
      await this.log.update(kind, ref, { status: 'skipped' })
      return { kind, ref, outcome: 'skipped' }
    }

    return this.announce(
      {
        kind,
        ref,
        name: `release-${ref}`,
        topicId: RESEND_TOPIC_IDS[MailingTopic.Updates],
        variables: releaseVariables({
          releases,
          previousVersion: lastAnnounced ?? versionBefore(sections, ref),
          now: input.now,
        }),
      },
      input
    )
  }

  /** The newest waiting notice per document; older ones are covered by it. */
  private policyCandidates(input: SendAnnouncementsInput): Candidate[] {
    const today = dayIn(input.now)
    const newest = new Map<string, LegalChange>()
    for (const change of input.legalChanges) {
      if (!change.notify || change.date > today) continue
      const current = newest.get(change.path)
      if (!current || change.date > current.date) {
        newest.set(change.path, change)
      }
    }
    return [...newest.values()].map((change) => {
      const page = change.path.slice(1)
      return {
        kind: AnnouncementKind.Policy,
        ref: `${page}@${change.date}`,
        name: `policy-${page}-${change.date}`,
        topicId: null,
        variables: policyVariables(change),
      }
    })
  }

  private async announce(
    candidate: Candidate,
    input: SendAnnouncementsInput
  ): Promise<AnnouncementReportEntry> {
    const { kind, ref, name } = candidate
    const entry = (
      outcome: AnnouncementOutcome,
      extra: Partial<AnnouncementReportEntry> = {}
    ): AnnouncementReportEntry => ({ kind, ref, outcome, ...extra })

    // 1. Already handled, or someone else's.
    const existing = await this.log.find(kind, ref)
    let previewId: string | null = null
    if (existing) {
      if (existing.status !== 'pending') return entry('already_announced')
      const age = input.now.getTime() - Date.parse(existing.updatedAt)
      if (age < STALE_CLAIM_MINUTES * MINUTE || input.dryRun) {
        return entry('in_progress')
      }
      const found = await this.broadcaster.findBroadcastByName(name)
      if (found) {
        await this.log.update(kind, ref, {
          status: 'scheduled',
          broadcastId: found.id,
          scheduledFor: found.scheduledAt,
          error: null,
        })
        return entry('reconciled', {
          scheduledFor: found.scheduledAt ?? undefined,
        })
      }
      previewId = existing.previewBroadcastId
    }

    // 2–3. The template, filled.
    const template = await this.broadcaster.getTemplate(
      ANNOUNCEMENT_TEMPLATE_ALIAS[kind]
    )
    if (!template || !template.published) {
      return entry('template_not_ready', {
        detail: `No published Resend template "${ANNOUNCEMENT_TEMPLATE_ALIAS[kind]}"`,
      })
    }
    const body = renderTemplate(
      template.html,
      candidate.variables,
      template.variables
    )
    const title = renderTemplate(
      template.subject ?? ANNOUNCEMENT_DEFAULT_SUBJECT[kind],
      candidate.variables,
      template.variables
    )
    const unresolved = [...new Set([...body.unresolved, ...title.unresolved])]
    if (unresolved.length > 0) {
      return entry('render_failed', { detail: unresolved.join(', ') })
    }
    const subject = asSubject(title.html)
    if (input.dryRun) return entry('would_send', { subject, html: body.html })

    // 4. The claim, before Resend sees anything.
    const fresh = !existing
    if (fresh && !(await this.log.claim(kind, ref))) {
      return entry('in_progress')
    }

    const scheduledAt = new Date(
      input.now.getTime() + ANNOUNCEMENT_HOLD_HOURS * HOUR
    ).toISOString()

    // 5. The preview. If it fails, nothing goes to the gyms.
    if (!previewId) {
      try {
        const preview = await this.broadcaster.createBroadcast({
          name: `${name}-preview`,
          segmentId: RESEND_TEST_SEGMENT_ID,
          topicId: null,
          subject: `[Preview] ${subject}`,
          html: withPreviewBanner(body.html, previewBanner(name, scheduledAt)),
          scheduledAt: null,
        })
        await this.log.update(kind, ref, { previewBroadcastId: preview.id })
      } catch (error) {
        if (fresh) await this.log.release(kind, ref)
        else await this.log.update(kind, ref, { error: message(error) })
        return entry('preview_failed', { detail: message(error) })
      }
    }

    // 6. The real send, after the hold.
    try {
      const broadcast = await this.broadcaster.createBroadcast({
        name,
        segmentId: input.testOnly
          ? RESEND_TEST_SEGMENT_ID
          : RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates],
        topicId: candidate.topicId,
        subject,
        html: body.html,
        scheduledAt,
      })
      await this.log.update(kind, ref, {
        status: 'scheduled',
        broadcastId: broadcast.id,
        scheduledFor: scheduledAt,
        error: null,
      })
      return entry('scheduled', { scheduledFor: scheduledAt })
    } catch (error) {
      await this.log.update(kind, ref, { error: message(error) })
      return entry('send_failed', { detail: message(error) })
    }
  }

  /** Scheduled sends whose time has passed: record what Resend did. */
  private async refreshScheduled(
    now: Date
  ): Promise<AnnouncementReportEntry[]> {
    const report: AnnouncementReportEntry[] = []
    for (const row of await this.log.listByStatus('scheduled')) {
      if (!row.broadcastId || !row.scheduledFor) continue
      if (Date.parse(row.scheduledFor) > now.getTime()) continue
      try {
        const state = await this.broadcaster.getBroadcastState(row.broadcastId)
        if (state === 'sent' || state === 'canceled') {
          await this.log.update(row.kind, row.ref, { status: state })
          report.push({
            kind: row.kind,
            ref: row.ref,
            outcome: 'refreshed',
            detail: state,
          })
        }
      } catch (error) {
        report.push({
          kind: row.kind,
          ref: row.ref,
          outcome: 'refresh_failed',
          detail: message(error),
        })
      }
    }
    return report
  }
}

/** The newest version in the file older than `version`, for `RELEASE_TYPE`. */
function versionBefore(
  sections: readonly ReleaseSection[],
  version: string
): string | null {
  const older = sections
    .map((s) => s.version)
    .filter((v) => compareVersions(v, version) < 0)
    .sort(compareVersions)
  return older[older.length - 1] ?? null
}
