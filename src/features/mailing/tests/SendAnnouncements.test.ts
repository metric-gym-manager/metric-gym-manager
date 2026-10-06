/**
 * @jest-environment node
 */
import type { LegalChange } from '@/features/marketing/config/legalChanges'
import {
  ANNOUNCEMENT_TEMPLATE_ALIAS,
  AnnouncementKind,
} from '../config/AnnouncementConfig'
import {
  MailingAudience,
  MailingTopic,
  RESEND_SEGMENT_IDS,
  RESEND_TEST_SEGMENT_ID,
  RESEND_TOPIC_IDS,
} from '../config/MailingConfig'
import {
  SendAnnouncements,
  type SendAnnouncementsInput,
} from '../services/SendAnnouncements'
import { FakeBroadcaster, MemoryAnnouncementLog } from './memoryAnnouncements'

const NOW = new Date('2026-10-21T04:00:00Z')
const HOUR = 3_600_000

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- **members**: not shipped yet

## [1.2.0] - 2026-10-20

### Added

- **payments**: record a part payment ([2222222](../../commit/2222222))

### Fixed

- **dashboard**: totals are right ([4444444](../../commit/4444444))

## [1.1.1] - 2026-10-12

### Performance

- **revenue**: the revenue page loads faster ([7777777](../../commit/7777777))

## [1.1.0] - 2026-10-08

### Fixed

- **ci**: stabilise the pipeline ([8888888](../../commit/8888888))
`

const RELEASE_TEMPLATE = {
  subject: 'Metric Gym OS {{{VERSION}}} is here',
  html:
    '<html><body><p>Hi {{{contact.gym_name|there}}}</p><h1>{{{VERSION}}}</h1>' +
    '{{{CHANGES_HTML}}}<a href="{{{UNSUBSCRIBE_URL}}}">Stop updates</a></body></html>',
  published: true,
  variables: [],
}

const POLICY_TEMPLATE = {
  subject: 'Changes to our {{{DOCUMENT_NAME}}}',
  html:
    '<html><body><h1>{{{DOCUMENT_NAME}}}</h1>{{{SUMMARY_HTML}}}' +
    '<a href="{{{PREFERENCES_URL}}}">Email choices</a></body></html>',
  published: true,
  variables: [],
}

const PRIVACY_NOTICE: LegalChange = {
  path: '/privacy',
  date: '2026-10-21',
  notify: true,
  summary: ['We changed how we email you.'],
}

function setup(options: { now?: Date; templates?: boolean } = {}): {
  log: MemoryAnnouncementLog
  broadcaster: FakeBroadcaster
  run: (
    input?: Partial<SendAnnouncementsInput>
  ) => ReturnType<SendAnnouncements['execute']>
  clock: { now: Date }
} {
  const clock = { now: options.now ?? NOW }
  const log = new MemoryAnnouncementLog(() => clock.now)
  const broadcaster = new FakeBroadcaster()
  if (options.templates !== false) {
    broadcaster.templates.set(
      ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Release],
      { ...RELEASE_TEMPLATE }
    )
    broadcaster.templates.set(
      ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Policy],
      { ...POLICY_TEMPLATE }
    )
  }
  const useCase = new SendAnnouncements(log, broadcaster)
  const run = (input: Partial<SendAnnouncementsInput> = {}) =>
    useCase.execute({
      appVersion: '1.2.0',
      changelog: CHANGELOG,
      legalChanges: [],
      now: clock.now,
      ...input,
    })
  return { log, broadcaster, run, clock }
}

const release = (report: Awaited<ReturnType<SendAnnouncements['execute']>>) =>
  report.filter((e) => e.kind === AnnouncementKind.Release)
const policy = (report: Awaited<ReturnType<SendAnnouncements['execute']>>) =>
  report.filter((e) => e.kind === AnnouncementKind.Policy)

describe('SendAnnouncements — a release', () => {
  it('previews to the Test segment now and schedules the real send 24 hours on', async () => {
    const { broadcaster, log, run } = setup()
    const report = await run()

    expect(release(report)).toEqual([
      expect.objectContaining({
        ref: '1.2.0',
        outcome: 'scheduled',
        scheduledFor: new Date(NOW.getTime() + 24 * HOUR).toISOString(),
      }),
    ])

    const [preview] = broadcaster.previews()
    expect(preview).toMatchObject({
      name: 'release-1.2.0-preview',
      segmentId: RESEND_TEST_SEGMENT_ID,
      topicId: null,
      scheduledAt: null,
      subject: '[Preview] Metric Gym OS 1.2.0 is here',
    })
    expect(preview.html).toContain('release-1.2.0')
    // When it goes, in Sri Lanka time: 04:00 UTC on the 22nd is 09:30 there.
    expect(preview.html).toContain('22 October 2026 at 09:30')

    const [real] = broadcaster.real()
    expect(real).toMatchObject({
      name: 'release-1.2.0',
      segmentId: RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates],
      topicId: RESEND_TOPIC_IDS[MailingTopic.Updates],
      subject: 'Metric Gym OS 1.2.0 is here',
      scheduledAt: new Date(NOW.getTime() + 24 * HOUR).toISOString(),
    })
    expect(real.html).toContain('Record a part payment.')
    expect(real.html).toContain('{{{contact.gym_name|there}}}')
    expect(real.html).not.toContain('Preview')

    expect(await log.find(AnnouncementKind.Release, '1.2.0')).toMatchObject({
      status: 'scheduled',
      broadcastId: real.id,
      previewBroadcastId: preview.id,
      scheduledFor: real.scheduledAt,
    })
  })

  it('never announces a version twice', async () => {
    const { broadcaster, run } = setup()
    await run()
    const second = await run()
    expect(release(second)).toEqual([
      expect.objectContaining({ outcome: 'no_release' }),
    ])
    expect(broadcaster.created).toHaveLength(2)
  })

  it('sends nothing while another run holds the claim', async () => {
    const { broadcaster, log, run } = setup()
    log.seed({
      kind: AnnouncementKind.Release,
      ref: '1.2.0',
      status: 'pending',
      broadcastId: null,
      previewBroadcastId: null,
      scheduledFor: null,
      error: null,
    })
    const report = await run()
    expect(release(report)).toEqual([
      expect.objectContaining({ ref: '1.2.0', outcome: 'in_progress' }),
    ])
    expect(broadcaster.created).toHaveLength(0)
  })

  it('loses a race for the claim gracefully: the run that inserted second sends nothing', async () => {
    const { broadcaster, log, run } = setup()
    // Both runs read "no row"; the other run's insert lands first.
    const realFind = log.find.bind(log)
    log.find = async (kind, ref) => {
      const row = await realFind(kind, ref)
      await log.claim(kind, ref)
      log.find = realFind
      return row
    }
    const report = await run()
    expect(release(report)).toEqual([
      expect.objectContaining({ ref: '1.2.0', outcome: 'in_progress' }),
    ])
    expect(broadcaster.created).toHaveLength(0)
  })

  it('folds every version since the last announcement into one email', async () => {
    const { broadcaster, log, run } = setup()
    log.seed({
      kind: AnnouncementKind.Release,
      ref: '1.1.0',
      status: 'skipped',
      broadcastId: null,
      previewBroadcastId: null,
      scheduledFor: null,
      error: null,
    })
    await run()
    const [real] = broadcaster.real()
    expect(real.name).toBe('release-1.2.0')
    expect(real.html).toContain('Record a part payment.')
    expect(real.html).toContain('The revenue page loads faster.')
  })

  it('sends nothing when the deployed version has no changelog section', async () => {
    const { broadcaster, log, run } = setup()
    const report = await run({ appVersion: '1.3.0' })
    expect(release(report)).toEqual([
      expect.objectContaining({ outcome: 'no_release' }),
    ])
    expect(broadcaster.created).toHaveLength(0)
    expect(log.rows.size).toBe(0)
  })

  it('records a release with nothing for gyms as skipped, and sends nothing', async () => {
    const { broadcaster, log, run } = setup()
    const report = await run({ appVersion: '1.1.0' })
    expect(release(report)).toEqual([
      expect.objectContaining({ ref: '1.1.0', outcome: 'skipped' }),
    ])
    expect(broadcaster.created).toHaveLength(0)
    expect((await log.find(AnnouncementKind.Release, '1.1.0'))?.status).toBe(
      'skipped'
    )
  })

  it('waits, holding nothing, until the template exists and is published', async () => {
    const { broadcaster, log, run } = setup({ templates: false })
    const first = await run()
    expect(release(first)).toEqual([
      expect.objectContaining({ outcome: 'template_not_ready' }),
    ])
    expect(log.rows.size).toBe(0)

    broadcaster.templates.set(
      ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Release],
      {
        ...RELEASE_TEMPLATE,
        published: false,
      }
    )
    expect(release(await run())[0].outcome).toBe('template_not_ready')
    expect(broadcaster.created).toHaveLength(0)

    broadcaster.templates.set(
      ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Release],
      {
        ...RELEASE_TEMPLATE,
      }
    )
    expect(release(await run())[0].outcome).toBe('scheduled')
  })

  it('refuses to send a template that uses a variable it was never given', async () => {
    const { broadcaster, log, run } = setup()
    broadcaster.templates.set(
      ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Release],
      {
        ...RELEASE_TEMPLATE,
        html: '<p>{{{VERSION}}} {{{HEADLINE}}}</p>',
      }
    )
    const report = await run()
    expect(release(report)).toEqual([
      expect.objectContaining({ outcome: 'render_failed', detail: 'HEADLINE' }),
    ])
    expect(broadcaster.created).toHaveLength(0)
    expect(log.rows.size).toBe(0)
  })

  it('sends nothing to gyms when the preview fails', async () => {
    const { broadcaster, log, run } = setup()
    broadcaster.failPreview = true
    const report = await run()
    expect(release(report)[0].outcome).toBe('preview_failed')
    expect(broadcaster.created).toHaveLength(0)
    expect(log.rows.size).toBe(0)
  })

  it('keeps an interrupted send claimed, then finishes it once stale without a second preview', async () => {
    const { broadcaster, log, run, clock } = setup()
    broadcaster.failReal = true
    expect(release(await run())[0].outcome).toBe('send_failed')
    expect(await log.find(AnnouncementKind.Release, '1.2.0')).toMatchObject({
      status: 'pending',
      error: 'Resend request timed out',
    })
    expect(broadcaster.previews()).toHaveLength(1)

    broadcaster.failReal = false
    clock.now = new Date(NOW.getTime() + 5 * 60_000)
    expect(release(await run())[0].outcome).toBe('in_progress')
    expect(broadcaster.real()).toHaveLength(0)

    clock.now = new Date(NOW.getTime() + 20 * 60_000)
    expect(release(await run())[0].outcome).toBe('scheduled')
    expect(broadcaster.real()).toHaveLength(1)
    expect(broadcaster.previews()).toHaveLength(1)
  })

  it('adopts a broadcast an interrupted run created instead of sending again', async () => {
    const { broadcaster, log, run, clock } = setup()
    await broadcaster.createBroadcast({
      name: 'release-1.2.0',
      segmentId: RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates],
      topicId: RESEND_TOPIC_IDS[MailingTopic.Updates],
      subject: 's',
      html: 'h',
      scheduledAt: '2026-10-22T04:00:00.000Z',
    })
    log.seed({
      kind: AnnouncementKind.Release,
      ref: '1.2.0',
      status: 'pending',
      broadcastId: null,
      previewBroadcastId: 'bc_preview',
      scheduledFor: null,
      error: 'Resend request timed out',
      updatedAt: NOW.toISOString(),
    })
    clock.now = new Date(NOW.getTime() + 20 * 60_000)
    const report = await run({ appVersion: '1.2.0' })
    expect(release(report)[0].outcome).toBe('reconciled')
    expect(broadcaster.created).toHaveLength(1)
    expect(await log.find(AnnouncementKind.Release, '1.2.0')).toMatchObject({
      status: 'scheduled',
      broadcastId: 'bc_1',
      scheduledFor: '2026-10-22T04:00:00.000Z',
      error: null,
    })
  })

  it('calls the first release with nothing announced before it by the version before it in the changelog', async () => {
    const { broadcaster, run } = setup()
    broadcaster.templates.set(
      ANNOUNCEMENT_TEMPLATE_ALIAS[AnnouncementKind.Release],
      {
        ...RELEASE_TEMPLATE,
        html: '<p>{{{RELEASE_TYPE}}}</p>',
      }
    )
    await run({ appVersion: '1.1.1' })
    expect(broadcaster.real()[0].html).toBe('<p>Fixes and improvements</p>')
  })

  it('sends the trial run to the Test segment only', async () => {
    const { broadcaster, run } = setup()
    await run({ testOnly: true })
    expect(broadcaster.real()[0].segmentId).toBe(RESEND_TEST_SEGMENT_ID)
  })
})

describe('SendAnnouncements — a policy change', () => {
  it('goes to every current gym with no topic, so the Updates opt-out does not stop it', async () => {
    const { broadcaster, log, run } = setup()
    const report = await run({
      appVersion: '1.0.0',
      legalChanges: [PRIVACY_NOTICE],
    })
    expect(policy(report)).toEqual([
      expect.objectContaining({
        ref: 'privacy@2026-10-21',
        outcome: 'scheduled',
      }),
    ])
    const [real] = broadcaster.real()
    expect(real).toMatchObject({
      name: 'policy-privacy-2026-10-21',
      segmentId: RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates],
      topicId: null,
      subject: 'Changes to our Privacy Policy',
    })
    expect(real.html).toContain('We changed how we email you.')
    expect(
      (await log.find(AnnouncementKind.Policy, 'privacy@2026-10-21'))?.status
    ).toBe('scheduled')
  })

  it('writes an ampersand in the subject as an ampersand', async () => {
    const { broadcaster, run } = setup()
    await run({
      appVersion: '1.0.0',
      legalChanges: [{ ...PRIVACY_NOTICE, path: '/refund-policy' }],
    })
    expect(broadcaster.real()[0].subject).toBe(
      'Changes to our Refund & Cancellation Policy'
    )
  })

  it('announces only the newest waiting change per document, and none that is editorial or not yet dated', async () => {
    const { broadcaster, run } = setup()
    const report = await run({
      appVersion: '1.0.0',
      legalChanges: [
        { ...PRIVACY_NOTICE, date: '2026-10-05', summary: ['Older.'] },
        PRIVACY_NOTICE,
        { ...PRIVACY_NOTICE, date: '2026-10-30', summary: ['Not yet.'] },
        { path: '/terms', date: '2026-10-10', notify: false, summary: [] },
      ],
    })
    expect(policy(report).map((e) => e.ref)).toEqual(['privacy@2026-10-21'])
    expect(broadcaster.real()).toHaveLength(1)
    expect(broadcaster.real()[0].html).not.toContain('Older.')
  })

  it('reads "today" in Sri Lanka', async () => {
    const { broadcaster, run } = setup({
      now: new Date('2026-10-20T19:00:00Z'),
    })
    await run({ appVersion: '1.0.0', legalChanges: [PRIVACY_NOTICE] })
    expect(broadcaster.real()).toHaveLength(1) // 00:30 on the 21st in Colombo
  })

  it('never announces a policy change twice', async () => {
    const { broadcaster, run } = setup()
    await run({ appVersion: '1.0.0', legalChanges: [PRIVACY_NOTICE] })
    const second = await run({
      appVersion: '1.0.0',
      legalChanges: [PRIVACY_NOTICE],
    })
    expect(policy(second)).toEqual([
      expect.objectContaining({ outcome: 'already_announced' }),
    ])
    expect(broadcaster.real()).toHaveLength(1)
  })
})

describe('SendAnnouncements — dry run', () => {
  it('renders what it would send and writes nothing anywhere', async () => {
    const { broadcaster, log, run } = setup()
    const report = await run({ dryRun: true, legalChanges: [PRIVACY_NOTICE] })
    expect(report.map((e) => e.outcome)).toEqual(['would_send', 'would_send'])
    expect(report[0].subject).toBe('Metric Gym OS 1.2.0 is here')
    expect(report[0].html).toContain('Record a part payment.')
    expect(broadcaster.created).toHaveLength(0)
    expect(log.rows.size).toBe(0)
  })

  it('reports an empty release as one it would skip', async () => {
    const { log, run } = setup()
    const report = await run({ dryRun: true, appVersion: '1.1.0' })
    expect(release(report)[0].outcome).toBe('would_skip')
    expect(log.rows.size).toBe(0)
  })
})

describe('SendAnnouncements — what became of a scheduled send', () => {
  function seedScheduled(
    log: MemoryAnnouncementLog,
    ref: string,
    scheduledFor: string
  ) {
    log.seed({
      kind: AnnouncementKind.Release,
      ref,
      status: 'scheduled',
      broadcastId: `bc_${ref}`,
      previewBroadcastId: null,
      scheduledFor,
      error: null,
    })
  }

  it('records a send once Resend says it went, and a cancel as canceled', async () => {
    const { broadcaster, log, run } = setup()
    seedScheduled(log, '1.2.0', '2026-10-20T04:00:00.000Z')
    seedScheduled(log, '1.1.1', '2026-10-13T04:00:00.000Z')
    broadcaster.states.set('bc_1.2.0', 'sent')
    broadcaster.states.set('bc_1.1.1', 'canceled')
    const report = await run()
    expect(report.filter((e) => e.outcome === 'refreshed')).toHaveLength(2)
    expect((await log.find(AnnouncementKind.Release, '1.2.0'))?.status).toBe(
      'sent'
    )
    expect((await log.find(AnnouncementKind.Release, '1.1.1'))?.status).toBe(
      'canceled'
    )
  })

  it('does not ask about a send whose time has not come', async () => {
    const { broadcaster, log, run } = setup()
    seedScheduled(log, '1.2.0', '2026-10-22T04:00:00.000Z')
    await run()
    expect(broadcaster.stateReads).toEqual([])
    expect((await log.find(AnnouncementKind.Release, '1.2.0'))?.status).toBe(
      'scheduled'
    )
  })

  it('leaves a send Resend still holds as scheduled', async () => {
    const { log, run } = setup()
    seedScheduled(log, '1.2.0', '2026-10-20T04:00:00.000Z')
    await run()
    expect((await log.find(AnnouncementKind.Release, '1.2.0'))?.status).toBe(
      'scheduled'
    )
  })
})
