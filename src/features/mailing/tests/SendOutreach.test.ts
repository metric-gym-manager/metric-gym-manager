/**
 * @jest-environment node
 */
import { MailingTopic, RESEND_TOPIC_IDS } from '../config/MailingConfig'
import {
  OUTREACH_MAX_FAILURES,
  OUTREACH_SEQUENCE_LENGTH,
} from '../config/outreachCampaign'
import type {
  IOutreachLedger,
  OutreachRecipient,
  OutreachStatus,
} from '../services/IOutreachLedger'
import type {
  IOutreachSender,
  OutreachEmail,
} from '../services/IOutreachSender'
import { SendOutreach } from '../services/SendOutreach'
import type { Prospect } from '../utils/prospectsCsv'
import { verifyUnsubscribeToken } from '../utils/unsubscribeToken'

const SECRET = 's'.repeat(40)
const CAMPAIGN = 'intro-test'
const DAY = 86_400_000
const WEEK1 = new Date('2026-10-13T04:30:00Z')
const week = (n: number) => new Date(WEEK1.getTime() + (n - 1) * 7 * DAY)

interface Row extends OutreachRecipient {
  status: OutreachStatus
  source: string
  lastSentAt: Date | null
  failures: number
  resendEmailId?: string
  error?: string
}

class MemoryLedger implements IOutreachLedger {
  rows = new Map<string, Row>()
  async addRecipients(
    _c: string,
    prospects: Prospect[],
    defaultSource: string
  ) {
    const added: string[] = []
    for (const p of prospects) {
      if (this.rows.has(p.email)) continue
      this.rows.set(p.email, {
        email: p.email,
        gymName: p.gymName,
        name: p.name,
        step: 0,
        status: 'active',
        source: p.source ?? defaultSource,
        lastSentAt: null,
        failures: 0,
      })
      added.push(p.email)
    }
    return added
  }
  async recipients() {
    return new Map([...this.rows].map(([e, r]) => [e, r.status]))
  }
  async due(_c: string, notSentSince: Date, limit: number) {
    return [...this.rows.values()]
      .filter(
        (r) =>
          r.status === 'active' &&
          r.step < OUTREACH_SEQUENCE_LENGTH &&
          (r.lastSentAt === null || r.lastSentAt <= notSentSince)
      )
      .slice(0, limit)
      .map(({ email, gymName, name, step }) => ({ email, gymName, name, step }))
  }
  async claim(_c: string, email: string, fromStep: number, at: Date) {
    const r = this.rows.get(email)
    if (!r || r.status !== 'active' || r.step !== fromStep) return false
    r.step = fromStep + 1
    r.lastSentAt = at
    return true
  }
  async recordSent(
    _c: string,
    email: string,
    step: number,
    resendEmailId: string
  ) {
    const r = this.rows.get(email)!
    r.resendEmailId = resendEmailId
    r.failures = 0
    if (step >= OUTREACH_SEQUENCE_LENGTH) r.status = 'done'
  }
  async recordFailure(
    _c: string,
    email: string,
    revertTo: number,
    error: string
  ) {
    const r = this.rows.get(email)!
    r.step = revertTo
    r.error = error
    r.failures += 1
    if (r.failures >= OUTREACH_MAX_FAILURES) r.status = 'failed'
  }
  async markDone(_c: string, email: string) {
    const r = this.rows.get(email)
    if (r) r.status = 'done'
  }
  async markUnsubscribed(_c: string, email: string) {
    const r = this.rows.get(email)
    if (!r) return false
    r.status = 'unsubscribed'
    return true
  }
}

class FakeSender implements IOutreachSender {
  contacts = new Map<string, string>()
  unreachable = new Set<string>()
  failFor = new Set<string>()
  checkFails = new Set<string>()
  sent: OutreachEmail[] = []
  async ensureContact(email: string, token: string) {
    if (!this.contacts.has(email)) this.contacts.set(email, token)
  }
  async canReceiveMarketing(email: string) {
    if (this.checkFails.has(email)) throw new Error('Resend is down')
    return !this.unreachable.has(email)
  }
  async send(email: OutreachEmail) {
    if (this.failFor.has(email.to)) throw new Error('Resend said no')
    this.sent.push(email)
    return `em_${this.sent.length}`
  }
  stepsTo(address: string) {
    return this.sent
      .filter((e) => e.to === address)
      .map((e) => e.tags.find((t) => t.name === 'email')?.value)
  }
}

const prospect = (email: string, source: string | null = null): Prospect => ({
  email,
  gymName: null,
  name: null,
  source,
})

function setup(known: string[] = []) {
  const ledger = new MemoryLedger()
  const sender = new FakeSender()
  const outreach = new SendOutreach(ledger, sender, async () => known, SECRET)
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
  return { ledger, sender, outreach, importList, runWeek, known }
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
