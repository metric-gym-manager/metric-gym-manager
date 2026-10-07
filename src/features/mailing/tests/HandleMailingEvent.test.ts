/**
 * @jest-environment node
 */
import { MailingTopic, RESEND_TOPIC_IDS } from '../config/MailingConfig'
import {
  OUTREACH_FROM,
  OUTREACH_UNSUBSCRIBE_ADDRESS,
} from '../config/outreachCampaign'
import type { ResendWebhookEvent } from '../schemas/mailingEvents.schemas'
import { HandleMailingEvent } from '../services/HandleMailingEvent'
import { OutreachBrake } from '../services/OutreachBrake'
import {
  FakeOwnerMailer,
  MemoryCampaigns,
  MemoryLedger,
} from './memoryOutreach'
import { MemoryMailingList } from './memoryMailingList'

/**
 * Resend's webhook, turned into the two owner tasks it replaces (owner
 * request, 2026-10-06): a hard bounce or spam complaint ends the series for
 * that address with no checking needed, and a mail app's unsubscribe-by-email
 * opts the sender out. Everything else written to the outreach domain is
 * passed to the owner.
 */
const CAMPAIGN = 'intro-test'
const NOW = new Date('2026-10-14T05:00:00Z')

async function setup(addresses = ['a@gym.lk', 'b@gym.lk', 'c@gym.lk']) {
  const ledger = new MemoryLedger(CAMPAIGN)
  ledger.clock = () => NOW
  await ledger.addRecipients(
    CAMPAIGN,
    addresses.map((email) => ({
      email,
      gymName: null,
      name: null,
      source: 'x',
    })),
    'public listing'
  )
  for (const email of addresses) {
    await ledger.claim(CAMPAIGN, email, 0, NOW)
    await ledger.recordSent(CAMPAIGN, email, 1, `em_${email}`)
  }
  const list = new MemoryMailingList()
  for (const email of addresses) list.seed(email)
  const owner = new FakeOwnerMailer()
  const campaigns = new MemoryCampaigns()
  const brake = new OutreachBrake(ledger, campaigns, owner)
  const handler = new HandleMailingEvent(ledger, list, owner, brake, () => NOW)
  return { ledger, list, owner, campaigns, handler }
}

const sent = (to: string, from = OUTREACH_FROM) => ({
  email_id: `em_${to}`,
  from,
  to: [to],
})
const bounced = (to: string, type = 'Permanent', from?: string) =>
  ({
    type: 'email.bounced',
    data: {
      ...sent(to, from),
      bounce: {
        type,
        subType: 'General',
        message: 'The recipient’s mailbox does not exist',
      },
    },
  }) as ResendWebhookEvent
const complained = (to: string, from?: string) =>
  ({ type: 'email.complained', data: sent(to, from) }) as ResendWebhookEvent
const received = (from: string, to: string[]) =>
  ({
    type: 'email.received',
    data: {
      email_id: 'rcv_1',
      from,
      to,
      cc: [],
      received_for: to,
      subject: 'unsubscribe',
    },
  }) as ResendWebhookEvent

describe('HandleMailingEvent — bounces and complaints', () => {
  it('ends the series for an address that hard-bounced, recording why', async () => {
    const { ledger, handler } = await setup()
    const result = await handler.execute(bounced('a@gym.lk'))
    expect(result).toMatchObject({
      outcome: 'stopped',
      status: 'bounced',
      campaigns: [CAMPAIGN],
    })
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('bounced')
    expect(ledger.events.at(-1)).toMatchObject({
      type: 'bounced',
      detail: 'The recipient’s mailbox does not exist',
    })
  })

  it('leaves a temporary bounce alone: Resend retries it', async () => {
    const { ledger, handler } = await setup()
    const result = await handler.execute(bounced('a@gym.lk', 'Transient'))
    expect(result.outcome).toBe('ignored')
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('active')
  })

  it('ends the series for a spam complaint, and opts the address out of all marketing', async () => {
    const { ledger, list, handler } = await setup()
    await handler.execute(complained('a@gym.lk'))
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('complained')
    expect(await list.optedOutTopics('a@gym.lk')).toEqual([
      MailingTopic.Marketing,
    ])
  })

  it('stops an address Resend refused to send to, without counting a new bounce', async () => {
    const { ledger, handler } = await setup()
    await handler.execute({
      type: 'email.suppressed',
      data: {
        ...sent('a@gym.lk'),
        suppressed: {
          type: 'Suppressed',
          reason: 'previous_bounce',
          message: 'bounced before',
        },
      },
    })
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('bounced')
    expect(ledger.events.at(-1)?.type).toBe('suppressed')
  })

  it('records an address suppressed for a past complaint as a complaint (Resend gives the cause in `reason`)', async () => {
    const { ledger, handler } = await setup()
    // As Resend sends it (inverted check, 2026-10-07): `type` is always
    // "Suppressed"; the cause is `reason`.
    await handler.execute({
      type: 'email.suppressed',
      data: {
        ...sent('a@gym.lk'),
        suppressed: {
          type: 'Suppressed',
          reason: 'previous_complaint',
          message: 'The recipient’s email address is on the suppression list',
        },
      },
    } as ResendWebhookEvent)
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('complained')
  })

  it('touches nothing for email that is not outreach (a gym’s own updates)', async () => {
    const { ledger, list, handler } = await setup()
    const from = 'Metric Gym OS <hello@updates.metricgymos.com>'
    expect(
      (await handler.execute(bounced('a@gym.lk', 'Permanent', from))).outcome
    ).toBe('ignored')
    expect((await handler.execute(complained('a@gym.lk', from))).outcome).toBe(
      'ignored'
    )
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('active')
    expect(list.writes).toEqual([])
  })

  it('records a webhook delivered twice only once', async () => {
    const { ledger, handler } = await setup()
    await handler.execute(complained('a@gym.lk'))
    await handler.execute(complained('a@gym.lk'))
    expect((await ledger.eventCounts(CAMPAIGN, new Date(0))).complained).toBe(1)
  })

  it('pauses the campaign at the second complaint and tells the owner, once', async () => {
    const { owner, campaigns, handler } = await setup()
    const first = await handler.execute(complained('a@gym.lk'))
    const second = await handler.execute(complained('b@gym.lk'))
    await handler.execute(complained('c@gym.lk'))
    expect(first).toMatchObject({ paused: [] })
    expect(second).toMatchObject({ paused: [CAMPAIGN] })
    expect((await campaigns.state(CAMPAIGN)).pauseReason).toBe(
      '2 spam complaints'
    )
    expect(owner.sent).toHaveLength(1)
  })
})

describe('HandleMailingEvent — unsubscribing by email', () => {
  it('opts the sender out and ends their series, whatever the case or display name', async () => {
    const { ledger, list, handler } = await setup()
    const result = await handler.execute(
      received('Ruwan Perera <A@Gym.lk>', [OUTREACH_UNSUBSCRIBE_ADDRESS])
    )
    expect(result).toMatchObject({
      outcome: 'unsubscribed',
      campaigns: [CAMPAIGN],
    })
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('unsubscribed')
    expect(await list.optedOutTopics('a@gym.lk')).toEqual([
      MailingTopic.Marketing,
    ])
  })

  it('honours it from someone not in any campaign too', async () => {
    const { list, handler } = await setup()
    list.seed('owner@titan.lk')
    await handler.execute(
      received('owner@titan.lk', [OUTREACH_UNSUBSCRIBE_ADDRESS])
    )
    expect(await list.optedOutTopics('owner@titan.lk')).toEqual([
      MailingTopic.Marketing,
    ])
  })

  it('passes anything else written to the outreach domain to the owner, and stops no one', async () => {
    const { ledger, owner, handler } = await setup()
    const result = await handler.execute(
      received('a@gym.lk', ['hello@go.metricgymos.com'])
    )
    expect(result).toEqual({ outcome: 'forwarded', forwardedId: 'fwd_1' })
    expect(owner.forwarded).toEqual(['rcv_1'])
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('active')
  })

  it('ignores an unsubscribe email with no usable sender', async () => {
    const { list, handler } = await setup()
    const result = await handler.execute(
      received('MAILER-DAEMON', [OUTREACH_UNSUBSCRIBE_ADDRESS])
    )
    expect(result.outcome).toBe('ignored')
    expect(list.writes).toEqual([])
  })
})

describe('HandleMailingEvent — opting out anywhere', () => {
  const topics = (
    subscription: 'opt_in' | 'opt_out',
    topic = MailingTopic.Marketing
  ) =>
    ({
      type: 'contact.topics.updated',
      data: {
        email: 'a@gym.lk',
        topics: [{ id: RESEND_TOPIC_IDS[topic], subscription }],
      },
    }) as ResendWebhookEvent

  it('ends the series at once when the address opts out of Marketing (footer link, one-click)', async () => {
    const { ledger, handler } = await setup()
    expect(await handler.execute(topics('opt_out'))).toMatchObject({
      outcome: 'unsubscribed',
      campaigns: [CAMPAIGN],
    })
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('unsubscribed')
  })

  it('ignores an opt-in, and an opt-out of product updates only', async () => {
    const { ledger, handler } = await setup()
    await handler.execute(topics('opt_in'))
    await handler.execute(topics('opt_out', MailingTopic.Updates))
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('active')
  })
})

/**
 * Inverted check, 2026-10-07: opting an address out in Resend makes Resend
 * send `contact.topics.updated` — a second webhook that can arrive while the
 * first is still being handled. Whichever lands first must not distort the
 * record: a complaint is a complaint, not also an unsubscribe.
 */
describe('HandleMailingEvent — the opt-out’s own webhook arriving mid-way', () => {
  async function racing() {
    const ctx = await setup()
    const optOut = ctx.list.optOut.bind(ctx.list)
    ctx.list.optOut = async (email, topics) => {
      await optOut(email, topics)
      await ctx.handler.execute({
        type: 'contact.topics.updated',
        data: {
          email,
          topics: [
            {
              id: RESEND_TOPIC_IDS[MailingTopic.Marketing],
              subscription: 'opt_out',
            },
          ],
        },
      })
    }
    return ctx
  }

  it('records a complaint as a complaint only', async () => {
    const { ledger, handler } = await racing()
    await handler.execute(complained('a@gym.lk'))
    expect(ledger.rows.get('a@gym.lk')?.status).toBe('complained')
    expect(await ledger.eventCounts(CAMPAIGN, new Date(0))).toMatchObject({
      complained: 1,
      unsubscribed: 0,
    })
  })

  it('reports the campaigns an unsubscribe-by-email ended', async () => {
    const { handler } = await racing()
    expect(
      await handler.execute(
        received('a@gym.lk', [OUTREACH_UNSUBSCRIBE_ADDRESS])
      )
    ).toMatchObject({ outcome: 'unsubscribed', campaigns: [CAMPAIGN] })
  })
})
