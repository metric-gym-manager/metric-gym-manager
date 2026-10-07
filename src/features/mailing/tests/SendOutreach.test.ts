/**
 * @jest-environment node
 */
import { MailingTopic, RESEND_TOPIC_IDS } from '../config/MailingConfig'
import { OutreachBrake } from '../services/OutreachBrake'
import { SendOutreach } from '../services/SendOutreach'
import type { Prospect } from '../utils/prospectsCsv'
import { verifyUnsubscribeToken } from '../utils/unsubscribeToken'
import {
  FakeOwnerMailer,
  FakeSender,
  MemoryCampaigns,
  MemoryLedger,
} from './memoryOutreach'

const SECRET = 's'.repeat(40)
const CAMPAIGN = 'intro-test'
const DAY = 86_400_000
const WEEK1 = new Date('2026-10-13T04:30:00Z')
const week = (n: number) => new Date(WEEK1.getTime() + (n - 1) * 7 * DAY)

const prospect = (email: string, source: string | null = null): Prospect => ({
  email,
  gymName: null,
  name: null,
  source,
})

function setup(known: string[] = []) {
  const ledger = new MemoryLedger(CAMPAIGN)
  const sender = new FakeSender()
  const campaigns = new MemoryCampaigns()
  const owner = new FakeOwnerMailer()
  const brake = new OutreachBrake(ledger, campaigns, owner)
  const outreach = new SendOutreach(
    ledger,
    sender,
    async () => known,
    SECRET,
    brake
  )
  const importList = (prospects: Prospect[], dryRun = false) =>
    outreach.importProspects({
      campaign: CAMPAIGN,
      prospects,
      defaultSource: 'public listing',
      dryRun,
    })
  const runWeek = (
    now: Date,
    extra: { limit?: number; dryRun?: boolean; deadline?: Date } = {}
  ) =>
    outreach.runWeek({
      campaign: CAMPAIGN,
      now,
      limit: extra.limit ?? 150,
      dryRun: extra.dryRun ?? false,
      ...(extra.deadline ? { deadline: extra.deadline } : {}),
    })
  return {
    ledger,
    sender,
    campaigns,
    owner,
    brake,
    outreach,
    importList,
    runWeek,
    known,
  }
}

describe('SendOutreach — importing the list', () => {
  it('records new addresses with where each was found, and adds each to Resend’s contacts', async () => {
    const { ledger, sender, importList } = setup()
    const report = await importList([
      prospect('a@gym.lk', 'www.alpha.lk'),
      prospect('b@gym.lk'),
    ])
    expect(report.counts.imported).toBe(2)
    expect(ledger.rows.get('a@gym.lk')?.source).toBe('www.alpha.lk')
    expect(ledger.rows.get('b@gym.lk')?.source).toBe('public listing')
    expect([...sender.contacts.keys()]).toEqual(['a@gym.lk', 'b@gym.lk'])
    expect(sender.sent).toHaveLength(0)
  })

  it('never takes in an existing gym or a demo request, whatever the case', async () => {
    const { ledger, sender, importList } = setup([
      'Owner@Titan.lk',
      'lead@demo.lk',
    ])
    const report = await importList([
      prospect('owner@titan.lk'),
      prospect('lead@demo.lk'),
      prospect('new@gym.lk'),
    ])
    expect(report.counts.known).toBe(2)
    expect([...ledger.rows.keys()]).toEqual(['new@gym.lk'])
    expect(sender.contacts.has('owner@titan.lk')).toBe(false)
  })

  // Inverted check, 2026-10-07: a gym owner's own inbox under another
  // spelling (Gmail ignores dots and everything after a `+`) was taken in.
  it('never takes in a gym’s address under another spelling of the same inbox', async () => {
    const { ledger, importList } = setup([
      'colomboshyan@gmail.com',
      'owner@titan.lk',
    ])
    const report = await importList([
      prospect('colomboshyan+outreach@gmail.com'),
      prospect('colombo.shyan@googlemail.com'),
      prospect('owner+gyms@titan.lk'),
      prospect('someone.else@gmail.com'),
    ])
    expect(report.counts.known).toBe(3)
    expect([...ledger.rows.keys()]).toEqual(['someone.else@gmail.com'])
  })

  it('writes nothing on a dry run', async () => {
    const { ledger, sender, importList } = setup(['owner@titan.lk'])
    const report = await importList(
      [prospect('owner@titan.lk'), prospect('a@gym.lk')],
      true
    )
    expect(report.counts).toMatchObject({ known: 1, imported: 1 })
    expect(ledger.rows.size).toBe(0)
    expect(sender.contacts.size).toBe(0)
  })
})

describe('SendOutreach — the weekly run', () => {
  it('sends the four emails in order, one a week, then stops', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    for (let n = 1; n <= 6; n++) await runWeek(week(n))
    expect(sender.stepsTo('a@gym.lk')).toEqual(['1', '2', '3', '4'])
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('done')
  })

  it('never sends twice in one week, however often it runs', async () => {
    const { sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    await runWeek(week(1))
    await runWeek(new Date(week(1).getTime() + 3 * DAY))
    expect(sender.stepsTo('a@gym.lk')).toEqual(['1'])
  })

  it('starts a late addition at email 1, whatever week the others are on', async () => {
    const { sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    await runWeek(week(1))
    await importList([prospect('b@gym.lk')])
    await runWeek(week(2))
    expect(sender.stepsTo('a@gym.lk')).toEqual(['1', '2'])
    expect(sender.stepsTo('b@gym.lk')).toEqual(['1'])
  })

  it('drops anyone who unsubscribed, for good', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    await runWeek(week(1))
    sender.unreachable.add('a@gym.lk')
    const report = await runWeek(week(2))
    sender.unreachable.delete('a@gym.lk')
    await runWeek(week(3))
    expect(report.counts.skipped).toBe(1)
    expect(sender.stepsTo('a@gym.lk')).toEqual(['1'])
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('unsubscribed')
  })

  it('retries a failed send the next week, and stops after repeated failures', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([prospect('bad@gym.lk'), prospect('ok@gym.lk')])
    sender.failFor.add('bad@gym.lk')
    const first = await runWeek(week(1))
    expect(first.counts).toMatchObject({ failed: 1, sent: 1 })
    expect(ledger.rows.get('bad@gym.lk')).toMatchObject({
      step: 0,
      error: 'Resend said no',
    })
    await runWeek(week(2))
    await runWeek(week(3))
    expect(ledger.rows.get('bad@gym.lk')?.status).toBe('failed')
    sender.failFor.delete('bad@gym.lk')
    await runWeek(week(4))
    expect(sender.stepsTo('bad@gym.lk')).toEqual([])
  })

  it('sends nothing for an address another run has just claimed', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    const realClaim = ledger.claim.bind(ledger)
    ledger.claim = async (c, e, from, at) => {
      await realClaim(c, e, from, at)
      return realClaim(c, e, from, at)
    }
    await runWeek(week(1))
    expect(sender.sent).toHaveLength(0)
  })

  it('never sends a fifth email, even if the ledger offers the address again', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    const row = ledger.rows.get('a@gym.lk')!
    row.step = 4
    ledger.due = async () => [
      { email: 'a@gym.lk', gymName: null, name: null, step: 4 },
    ]
    const report = await runWeek(week(1))
    expect(sender.sent).toHaveLength(0)
    expect(report.counts.failed).toBe(0)
    expect(row.step).toBe(4)
  })

  it('stops at the run’s limit and carries the rest to the next run', async () => {
    const { sender, importList, runWeek } = setup()
    await importList(['a', 'b', 'c'].map((x) => prospect(`${x}@gym.lk`)))
    await runWeek(week(1), { limit: 2 })
    expect(sender.sent).toHaveLength(2)
    await runWeek(new Date(week(1).getTime() + DAY), { limit: 2 })
    expect(sender.stepsTo('c@gym.lk')).toEqual(['1'])
  })

  it('reports who would get which email on a dry run, and sends nothing', async () => {
    const { sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    const report = await runWeek(week(1), { dryRun: true })
    expect(report.counts.would_send).toBe(1)
    expect(report.entries[0]).toMatchObject({
      email: 'a@gym.lk',
      outcome: 'would_send',
      step: 1,
    })
    expect(sender.sent).toHaveLength(0)
  })
})

/**
 * Inverted check of the series, 2026-10-06 (docs/architecture/outreach-inverted-check.md).
 */
describe('SendOutreach — what the inverted check found', () => {
  it('carries on with everyone else when one address cannot be checked', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([
      prospect('a@gym.lk'),
      prospect('b@gym.lk'),
      prospect('c@gym.lk'),
    ])
    sender.checkFails.add('a@gym.lk')
    const report = await runWeek(week(1))
    expect(sender.sent.map((e) => e.to)).toEqual(['b@gym.lk', 'c@gym.lk'])
    expect(report.counts.failed).toBe(1)
    // Not the address's fault: nothing claimed, nothing counted against it.
    expect(ledger.rows.get('a@gym.lk')).toMatchObject({
      step: 0,
      failures: 0,
      status: 'active',
    })
  })

  it('stops the series for an address that has since become a gym or requested a demo', async () => {
    const { ledger, sender, importList, runWeek, known } = setup()
    await importList([prospect('a@gym.lk'), prospect('b@gym.lk')])
    await runWeek(week(1))
    known.push('A@gym.lk')
    const report = await runWeek(week(2))
    expect(sender.stepsTo('a@gym.lk')).toEqual(['1'])
    expect(sender.stepsTo('b@gym.lk')).toEqual(['1', '2'])
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('done')
    expect(report.counts.known).toBe(1)
  })

  it('stops the series for an address whose inbox has since become a gym’s, however it is spelled', async () => {
    const { ledger, sender, importList, runWeek, known } = setup()
    await importList([prospect('ruwan+gym@gmail.com')])
    known.push('Ruwan@gmail.com')
    await runWeek(week(1))
    expect(sender.sent).toHaveLength(0)
    expect(ledger.rows.get('ruwan+gym@gmail.com')?.status).toBe('done')
  })

  it('says on a dry run that an address became a customer, and changes nothing', async () => {
    const { ledger, importList, runWeek, known } = setup()
    await importList([prospect('a@gym.lk')])
    known.push('a@gym.lk')
    const report = await runWeek(week(1), { dryRun: true })
    expect(report.counts).toMatchObject({ known: 1, would_send: 0 })
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('active')
  })

  it('stops starting new sends once its time is up, leaving the rest due', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk'), prospect('b@gym.lk')])
    const report = await runWeek(week(1), { deadline: new Date(0) })
    expect(sender.sent).toHaveLength(0)
    expect(report.counts.deferred).toBe(2)
    expect(ledger.rows.get('a@gym.lk')).toMatchObject({
      step: 0,
      status: 'active',
    })
  })
})

describe('SendOutreach — every email', () => {
  it('carries the recipient’s own unsubscribe link and a one-click unsubscribe for mail apps', async () => {
    const { sender, importList, runWeek } = setup()
    await importList([prospect('owner+gym@titan.lk')])
    await runWeek(week(1))
    const [email] = sender.sent
    const page = new URL(email.unsubscribeUrl)
    expect(page.pathname).toBe('/unsubscribe')
    expect(page.searchParams.get('email')).toBe('owner+gym@titan.lk')
    expect(page.searchParams.get('topic')).toBe('marketing')
    const token = page.searchParams.get('token') ?? ''
    expect(verifyUnsubscribeToken('owner+gym@titan.lk', token, SECRET)).toBe(
      true
    )
    expect(email.html).toContain(token)
    const oneClick = new URL(email.oneClickUrl)
    expect(oneClick.pathname).toBe('/api/public/email-preferences/one-click')
    expect(oneClick.searchParams.get('token')).toBe(token)
    expect(email.topicId).toBe(RESEND_TOPIC_IDS[MailingTopic.Marketing])
  })

  it('is tagged in Resend by campaign and email number, and sent once per step', async () => {
    const { sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    await runWeek(week(1))
    expect(sender.sent[0].tags).toEqual([
      { name: 'kind', value: 'outreach' },
      { name: 'campaign', value: CAMPAIGN },
      { name: 'email', value: '1' },
    ])
    expect(sender.sent[0].idempotencyKey).toBe(
      `outreach:${CAMPAIGN}:1:a@gym.lk`
    )
  })

  it('sends a chosen email of the four to one address for a test, outside the campaign', async () => {
    const { ledger, sender, outreach } = setup()
    await outreach.sendTest('me@metric.lk', 3)
    expect(sender.stepsTo('me@metric.lk')).toEqual(['3'])
    expect(ledger.rows.size).toBe(0)
  })

  it('can send the same test again after the email changed (Resend keeps idempotency keys for 24 hours)', async () => {
    const { sender, outreach } = setup()
    await outreach.sendTest('me@metric.lk', 1)
    await outreach.sendTest('me@metric.lk', 1)
    const [first, second] = sender.sent
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey)
    expect(first.tags).toContainEqual({ name: 'campaign', value: 'test' })
  })

  it('takes an address out of the campaign on request', async () => {
    const { ledger, sender, importList, outreach, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    expect(await outreach.remove(CAMPAIGN, 'A@gym.lk')).toBe(true)
    await runWeek(week(1))
    expect(sender.sent).toHaveLength(0)
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('unsubscribed')
  })
})

/**
 * The safety brake and the event log (owner request, 2026-10-06): the run
 * sends nothing while the campaign is paused, stops the moment a webhook
 * pauses it, and records every send for the brake to count.
 */
describe('SendOutreach — the safety brake', () => {
  it('records every send, for the brake and the weekly summary to count', async () => {
    const { ledger, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk'), prospect('b@gym.lk')])
    await runWeek(week(1))
    expect((await ledger.eventCounts(CAMPAIGN, new Date(0))).sent).toBe(2)
  })

  it('records an unsubscribe it finds, once', async () => {
    const { ledger, sender, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    await runWeek(week(1))
    sender.unreachable.add('a@gym.lk')
    await runWeek(week(2))
    await runWeek(week(3))
    expect((await ledger.eventCounts(CAMPAIGN, new Date(0))).unsubscribed).toBe(
      1
    )
  })

  it('sends nothing while the campaign is paused, and says so', async () => {
    const { sender, brake, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk')])
    await brake.pause(CAMPAIGN, 'checking the list', week(1))
    const report = await runWeek(week(1))
    expect(sender.sent).toHaveLength(0)
    expect(report.paused).toEqual({
      since: week(1),
      reason: 'checking the list',
    })
  })

  it('pauses before sending when complaints already passed the limit, and alerts the owner', async () => {
    const { ledger, sender, owner, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk'), prospect('b@gym.lk')])
    await runWeek(week(1))
    await ledger.stop('a@gym.lk', 'complained')
    await ledger.stop('b@gym.lk', 'complained')
    const report = await runWeek(week(2))
    expect(sender.sent).toHaveLength(2)
    expect(report.paused?.reason).toBe('2 spam complaints')
    expect(owner.sent).toHaveLength(1)
  })

  it('stops at once when a webhook pauses the campaign mid-run', async () => {
    const { sender, brake, importList, runWeek } = setup()
    await importList(['a', 'b', 'c'].map((x) => prospect(`${x}@gym.lk`)))
    sender.afterSend = async () => {
      await brake.pause(CAMPAIGN, '2 spam complaints', week(1))
    }
    const report = await runWeek(week(1))
    expect(sender.sent.map((e) => e.to)).toEqual(['a@gym.lk'])
    expect(report.paused?.reason).toBe('2 spam complaints')
  })

  it('reports what the brake would do on a dry run, and pauses nothing', async () => {
    const { ledger, campaigns, importList, runWeek } = setup()
    await importList([prospect('a@gym.lk'), prospect('b@gym.lk')])
    await runWeek(week(1))
    await ledger.stop('a@gym.lk', 'complained')
    await ledger.stop('b@gym.lk', 'complained')
    const report = await runWeek(week(2), { dryRun: true })
    expect(report.wouldPause).toBe('2 spam complaints')
    expect((await campaigns.state(CAMPAIGN)).pausedAt).toBeNull()
  })
})
