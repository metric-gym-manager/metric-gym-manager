/**
 * @jest-environment node
 */
import { MAILING_REPLY_TO } from '../config/MailingConfig'
import { OUTREACH_FROM } from '../config/outreachCampaign'
import {
  ResendOutreachSender,
  type OutreachResendApi,
} from '../services/ResendOutreachSender'

const ok = <T>(data: T) => Promise.resolve({ data, error: null })
const fail = (name: string, message = name) =>
  Promise.resolve({ data: null, error: { name, message } })

function api(
  over: Partial<Record<'get' | 'create' | 'topics' | 'send', jest.Mock>> = {}
) {
  const m = {
    get: over.get ?? jest.fn(() => fail('not_found')),
    create: over.create ?? jest.fn(() => ok({ id: 'c1' })),
    topics: over.topics ?? jest.fn(() => ok({ data: [], has_more: false })),
    send: over.send ?? jest.fn(() => ok({ id: 'em_1' })),
  }
  const resend: OutreachResendApi = {
    contacts: { get: m.get, create: m.create, topics: { list: m.topics } },
    emails: { send: m.send },
  }
  return { resend, m }
}

const EMAIL = {
  to: 'a@gym.lk',
  subject: 'Tired of chasing payments?',
  html: '<p>hi</p>',
  text: 'hi',
  unsubscribeUrl:
    'https://www.metricgymos.com/unsubscribe?email=a%40gym.lk&token=t&topic=marketing',
  oneClickUrl:
    'https://www.metricgymos.com/api/public/email-preferences/one-click?email=a%40gym.lk&token=t&topic=marketing',
  topicId: 'topic_marketing',
  tags: [
    { name: 'kind', value: 'outreach' },
    { name: 'campaign', value: 'intro-2026-10' },
    { name: 'email', value: '1' },
  ],
  idempotencyKey: 'outreach:intro-2026-10:1:a@gym.lk',
}

describe('ResendOutreachSender', () => {
  it('creates a missing contact with its token and gym, in no segment', async () => {
    const { resend, m } = api()
    await new ResendOutreachSender(resend).ensureContact(
      'a@gym.lk',
      'tok',
      'Alpha'
    )
    expect(m.create).toHaveBeenCalledWith(
      {
        email: 'a@gym.lk',
        properties: { unsubscribe_token: 'tok', gym_name: 'Alpha' },
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('leaves an existing contact, and its token, alone', async () => {
    const { resend, m } = api({
      get: jest.fn(() => ok({ id: 'c1', unsubscribed: false })),
    })
    await new ResendOutreachSender(resend).ensureContact(
      'a@gym.lk',
      'tok',
      null
    )
    expect(m.create).not.toHaveBeenCalled()
  })

  it('throws when a contact cannot be read or created', async () => {
    const { resend } = api({
      get: jest.fn(() => fail('application_error', 'down')),
    })
    await expect(
      new ResendOutreachSender(resend).ensureContact('a@gym.lk', 'tok', null)
    ).rejects.toThrow('down')
  })

  it.each([
    [
      'opted out of marketing',
      { unsubscribed: false },
      [{ id: 'f6e083f1-e3aa-4ade-87b3-6131027728d4', subscription: 'opt_out' }],
      false,
    ],
    ['unsubscribed from everything', { unsubscribed: true }, [], false],
    [
      'still subscribed',
      { unsubscribed: false },
      [{ id: 'f6e083f1-e3aa-4ade-87b3-6131027728d4', subscription: 'opt_in' }],
      true,
    ],
  ])('reads a contact %s', async (_label, contact, topics, expected) => {
    const { resend } = api({
      get: jest.fn(() => ok({ id: 'c1', ...contact })),
      topics: jest.fn(() => ok({ data: topics, has_more: false })),
    })
    expect(
      await new ResendOutreachSender(resend).canReceiveMarketing('a@gym.lk')
    ).toBe(expected)
  })

  it('sends from the outreach address with a plain-text part, one-click unsubscribe headers, tags and an idempotency key', async () => {
    const { resend, m } = api()
    expect(await new ResendOutreachSender(resend).send(EMAIL)).toBe('em_1')
    expect(m.send).toHaveBeenCalledWith(
      {
        from: OUTREACH_FROM,
        replyTo: MAILING_REPLY_TO,
        to: 'a@gym.lk',
        subject: 'Tired of chasing payments?',
        html: '<p>hi</p>',
        text: 'hi',
        topicId: 'topic_marketing',
        tags: EMAIL.tags,
        headers: {
          'List-Unsubscribe': `<${EMAIL.oneClickUrl}>, <mailto:${MAILING_REPLY_TO}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        idempotencyKey: 'outreach:intro-2026-10:1:a@gym.lk',
      })
    )
  })

  it('throws when Resend refuses the send', async () => {
    const { resend } = api({
      send: jest.fn(() => fail('validation_error', 'bad address')),
    })
    await expect(new ResendOutreachSender(resend).send(EMAIL)).rejects.toThrow(
      'bad address'
    )
  })
})
