/**
 * @jest-environment node
 */
import { RESEND_TOPIC_IDS, MailingTopic } from '../config/MailingConfig'
import type {
  IOutreachLedger,
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

class MemoryLedger implements IOutreachLedger {
  rows = new Map<
    string,
    Prospect & {
      status: OutreachStatus
      resendEmailId?: string
      error?: string
      source: string
    }
  >()
  async addRecipients(
    _campaign: string,
    prospects: Prospect[],
    source: string
  ) {
    let added = 0
    for (const p of prospects) {
      if (this.rows.has(p.email)) continue
      this.rows.set(p.email, { ...p, status: 'pending', source })
      added++
    }
    return added
  }
  async recipients() {
    return new Map([...this.rows].map(([email, row]) => [email, row.status]))
  }
  async pending(_campaign: string, limit: number) {
    return [...this.rows.values()]
      .filter((row) => row.status === 'pending')
      .slice(0, limit)
      .map(({ email, gymName, name }) => ({ email, gymName, name }))
  }
  async mark(
    _campaign: string,
    email: string,
    patch: { status: OutreachStatus; resendEmailId?: string; error?: string }
  ) {
    const row = this.rows.get(email)
    if (!row) throw new Error(`no ${email}`)
    Object.assign(row, patch)
  }
}

class FakeSender implements IOutreachSender {
  contacts = new Map<string, string>()
  unreachable = new Set<string>()
  failFor = new Set<string>()
  sent: OutreachEmail[] = []
  async ensureContact(email: string, token: string) {
    if (!this.contacts.has(email)) this.contacts.set(email, token)
  }
  async canReceiveMarketing(email: string) {
    return !this.unreachable.has(email)
  }
  async send(email: OutreachEmail) {
    if (this.failFor.has(email.to)) throw new Error('Resend said no')
    this.sent.push(email)
    return `em_${this.sent.length}`
  }
}

const prospect = (email: string, gymName: string | null = null): Prospect => ({
  email,
  gymName,
  name: null,
})

function setup(known: string[] = []) {
  const ledger = new MemoryLedger()
  const sender = new FakeSender()
  const useCase = new SendOutreach(ledger, sender, async () => known, SECRET)
  return { ledger, sender, useCase }
}

const run = (
  useCase: SendOutreach,
  prospects: Prospect[],
  extra: Partial<Parameters<SendOutreach['execute']>[0]> = {}
) =>
  useCase.execute({
    campaign: CAMPAIGN,
    prospects,
    source: 'public listing',
    limit: 50,
    dryRun: false,
    ...extra,
  })

describe('SendOutreach', () => {
  it('records every new address, then sends the introduction to each', async () => {
    const { ledger, sender, useCase } = setup()
    const report = await run(useCase, [
      prospect('a@gym.lk', 'Alpha'),
      prospect('b@gym.lk'),
    ])
    expect(report.counts).toMatchObject({ imported: 2, sent: 2 })
    expect(sender.sent.map((e) => e.to)).toEqual(['a@gym.lk', 'b@gym.lk'])
    expect(ledger.rows.get('a@gym.lk')).toMatchObject({
      status: 'sent',
      resendEmailId: 'em_1',
      source: 'public listing',
    })
  })

  it('never emails an existing gym or a demo request, whatever the case', async () => {
    const { ledger, sender, useCase } = setup([
      'Owner@Titan.lk',
      'lead@demo.lk',
    ])
    const report = await run(useCase, [
      prospect('owner@titan.lk'),
      prospect('lead@demo.lk'),
      prospect('new@gym.lk'),
    ])
    expect(sender.sent.map((e) => e.to)).toEqual(['new@gym.lk'])
    expect(report.counts.known).toBe(2)
    expect(ledger.rows.has('owner@titan.lk')).toBe(false)
  })

  it('never sends the same campaign to an address twice', async () => {
    const { sender, useCase } = setup()
    await run(useCase, [prospect('a@gym.lk')])
    const second = await run(useCase, [prospect('a@gym.lk')])
    expect(sender.sent).toHaveLength(1)
    expect(second.counts).toMatchObject({ imported: 0, sent: 0 })
  })

  it('stops at the batch limit and leaves the rest for the next run', async () => {
    const { ledger, sender, useCase } = setup()
    const list = ['a', 'b', 'c'].map((x) => prospect(`${x}@gym.lk`))
    await run(useCase, list, { limit: 2 })
    expect(sender.sent).toHaveLength(2)
    expect(ledger.rows.get('c@gym.lk')?.status).toBe('pending')
    await run(useCase, list, { limit: 2 })
    expect(sender.sent.map((e) => e.to)).toEqual([
      'a@gym.lk',
      'b@gym.lk',
      'c@gym.lk',
    ])
  })

  it('skips anyone who unsubscribed, and never asks again', async () => {
    const { ledger, sender, useCase } = setup()
    sender.unreachable.add('gone@gym.lk')
    const report = await run(useCase, [prospect('gone@gym.lk')])
    expect(sender.sent).toHaveLength(0)
    expect(report.counts.skipped).toBe(1)
    expect(ledger.rows.get('gone@gym.lk')?.status).toBe('skipped')
  })

  it('records a failed send and carries on with the rest', async () => {
    const { ledger, sender, useCase } = setup()
    sender.failFor.add('bad@gym.lk')
    const report = await run(useCase, [
      prospect('bad@gym.lk'),
      prospect('ok@gym.lk'),
    ])
    expect(report.counts).toMatchObject({ failed: 1, sent: 1 })
    expect(ledger.rows.get('bad@gym.lk')).toMatchObject({
      status: 'failed',
      error: 'Resend said no',
    })
  })

  it('gives each recipient a working unsubscribe link of their own, on the Marketing topic', async () => {
    const { sender, useCase } = setup()
    await run(useCase, [prospect('owner+gym@titan.lk')])
    const [email] = sender.sent
    const url = new URL(email.unsubscribeUrl)
    expect(url.pathname).toBe('/unsubscribe')
    expect(url.searchParams.get('email')).toBe('owner+gym@titan.lk')
    expect(url.searchParams.get('topic')).toBe('marketing')
    expect(
      verifyUnsubscribeToken(
        'owner+gym@titan.lk',
        url.searchParams.get('token') ?? '',
        SECRET
      )
    ).toBe(true)
    expect(email.html).toContain(url.searchParams.get('token') ?? 'missing')
    expect(email.topicId).toBe(RESEND_TOPIC_IDS[MailingTopic.Marketing])
    expect(sender.contacts.get('owner+gym@titan.lk')).toBe(
      url.searchParams.get('token')
    )
  })

  it('writes nothing and sends nothing on a dry run, and says what it would do', async () => {
    const { ledger, sender, useCase } = setup(['owner@titan.lk'])
    const report = await run(
      useCase,
      [prospect('owner@titan.lk'), prospect('a@gym.lk'), prospect('b@gym.lk')],
      { dryRun: true, limit: 1 }
    )
    expect(ledger.rows.size).toBe(0)
    expect(sender.sent).toHaveLength(0)
    expect(sender.contacts.size).toBe(0)
    expect(report.counts).toMatchObject({
      known: 1,
      imported: 2,
      would_send: 1,
    })
  })

  it('sends one test email without touching the campaign', async () => {
    const { ledger, sender, useCase } = setup()
    await useCase.sendTest('me@metric.lk')
    expect(sender.sent.map((e) => e.to)).toEqual(['me@metric.lk'])
    expect(ledger.rows.size).toBe(0)
  })
})
