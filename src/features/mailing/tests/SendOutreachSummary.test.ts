/**
 * @jest-environment node
 */
import { SendOutreachSummary } from '../services/SendOutreachSummary'
import {
  FakeOwnerMailer,
  MemoryCampaigns,
  MemoryLedger,
  type MemoryEvent,
} from './memoryOutreach'

/**
 * The weekly summary (owner request, 2026-10-06): a short email to hello@
 * each Monday — sent, bounced, complaints, unsubscribed, and whether the
 * campaign is running — in place of checking Resend by hand.
 */
const CAMPAIGN = 'intro-test'
const DAY = 86_400_000
// Monday 19 October 2026, 10:00 in Sri Lanka (the daily run).
const MONDAY = new Date('2026-10-19T04:30:00Z')
const TUESDAY = new Date(MONDAY.getTime() + DAY)

async function setup() {
  const ledger = new MemoryLedger(CAMPAIGN)
  ledger.clock = () => new Date(MONDAY.getTime() - DAY)
  const campaigns = new MemoryCampaigns()
  const owner = new FakeOwnerMailer()
  const summary = new SendOutreachSummary(ledger, campaigns, owner)
  await ledger.addRecipients(
    CAMPAIGN,
    ['a', 'b', 'c', 'd'].map((x) => ({
      email: `${x}@gym.lk`,
      gymName: null,
      name: null,
      source: 'x',
    })),
    'public listing'
  )
  const event = (type: MemoryEvent['type'], email: string, at: Date) =>
    ledger.events.push({
      campaign: CAMPAIGN,
      email,
      type,
      step: 1,
      detail: null,
      at,
    })
  return { ledger, campaigns, owner, summary, event }
}

describe('SendOutreachSummary', () => {
  it('sends on Monday morning with the last 7 days in numbers', async () => {
    const { ledger, owner, summary, event } = await setup()
    const lastWeek = new Date(MONDAY.getTime() - 6 * DAY)
    for (const x of ['a', 'b', 'c', 'd']) event('sent', `${x}@gym.lk`, lastWeek)
    event('sent', 'a@gym.lk', new Date(MONDAY.getTime() - 9 * DAY)) // the week before
    await ledger.stop('d@gym.lk', 'bounced')
    ledger.rows.get('a@gym.lk')!.step = 1
    ledger.rows.get('b@gym.lk')!.step = 1
    expect(await summary.sendIfDue(CAMPAIGN, MONDAY)).toEqual({
      outcome: 'sent',
      id: 'owner_1',
    })
    const [email] = owner.sent
    expect(email.subject).toBe(
      'Outreach this week: 4 sent, 1 bounce, 0 spam complaints'
    )
    expect(email.text).toContain('Running')
    expect(email.text).toContain('Emails sent: 4')
    expect(email.text).toContain('Bounced: 1 (25%)')
    expect(email.text).toContain('Had email 1, next is 2: 2')
    expect(email.idempotencyKey).toBe(`outreach-summary:${CAMPAIGN}:2026-10-19`)
  })

  it('waits for Monday', async () => {
    const { owner, summary } = await setup()
    expect(await summary.sendIfDue(CAMPAIGN, TUESDAY)).toEqual({
      outcome: 'not_due',
    })
    expect(owner.sent).toHaveLength(0)
  })

  it('sends once a week, however often Monday’s run is repeated', async () => {
    const { owner, summary } = await setup()
    await summary.sendIfDue(CAMPAIGN, MONDAY)
    expect(
      await summary.sendIfDue(CAMPAIGN, new Date(MONDAY.getTime() + 3_600_000))
    ).toEqual({ outcome: 'already_sent' })
    expect(owner.sent).toHaveLength(1)
    await summary.sendIfDue(CAMPAIGN, new Date(MONDAY.getTime() + 7 * DAY))
    expect(owner.sent).toHaveLength(2)
  })

  it('leads with a pause, its reason and how to resume', async () => {
    const { campaigns, owner, summary } = await setup()
    await campaigns.pause(CAMPAIGN, '2 spam complaints', MONDAY, true)
    await summary.sendIfDue(CAMPAIGN, MONDAY)
    expect(owner.sent[0].subject).toBe('Outreach paused: 2 spam complaints')
    expect(owner.sent[0].text).toContain('Paused since')
    expect(owner.sent[0].text).toContain(
      'npx tsx scripts/send-outreach.ts --resume'
    )
  })

  it('sends a last summary the week the series ends, then stops', async () => {
    const { ledger, owner, summary, event } = await setup()
    for (const row of ledger.rows.values()) row.status = 'done'
    event('sent', 'a@gym.lk', new Date(MONDAY.getTime() - 2 * DAY))
    await summary.sendIfDue(CAMPAIGN, MONDAY)
    expect(owner.sent[0].text).toContain('Finished')
    expect(
      await summary.sendIfDue(CAMPAIGN, new Date(MONDAY.getTime() + 7 * DAY))
    ).toEqual({ outcome: 'over' })
    expect(owner.sent).toHaveLength(1)
  })

  it('reports nothing for a campaign with no one in it', async () => {
    const { owner } = await setup()
    const empty = new SendOutreachSummary(
      new MemoryLedger('other'),
      new MemoryCampaigns(),
      owner
    )
    expect(await empty.sendIfDue('other', MONDAY)).toEqual({ outcome: 'over' })
  })

  it('sends one on request without taking Monday’s place', async () => {
    const { owner, summary } = await setup()
    const email = (await summary.compose(CAMPAIGN, TUESDAY))!
    await summary.sendNow(email)
    await summary.sendNow(email)
    expect(owner.sent).toHaveLength(2)
    expect(await summary.sendIfDue(CAMPAIGN, MONDAY)).toMatchObject({
      outcome: 'sent',
    })
  })

  it('composes a preview for the owner without claiming the week', async () => {
    const { owner, summary } = await setup()
    const email = await summary.compose(CAMPAIGN, TUESDAY)
    expect(email?.subject).toContain('Outreach this week')
    expect(owner.sent).toHaveLength(0)
    expect(await summary.sendIfDue(CAMPAIGN, MONDAY)).toMatchObject({
      outcome: 'sent',
    })
  })
})
