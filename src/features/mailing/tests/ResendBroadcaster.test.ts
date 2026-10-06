/**
 * @jest-environment node
 */
import { MAILING_FROM, MAILING_REPLY_TO } from '../config/MailingConfig'
import {
  ResendBroadcaster,
  type AnnouncementResendApi,
} from '../services/ResendBroadcaster'

const ok = <T>(data: T) => Promise.resolve({ data, error: null })
const fail = (name: string, message = name) =>
  Promise.resolve({ data: null, error: { name, message } })

function api(
  overrides: Partial<{
    templateGet: jest.Mock
    create: jest.Mock
    list: jest.Mock
    get: jest.Mock
  }> = {}
) {
  const mocks = {
    templateGet: overrides.templateGet ?? jest.fn(),
    create: overrides.create ?? jest.fn(() => ok({ id: 'bc_1' })),
    list: overrides.list ?? jest.fn(() => ok({ data: [], has_more: false })),
    get: overrides.get ?? jest.fn(),
  }
  const resend: AnnouncementResendApi = {
    templates: { get: mocks.templateGet },
    broadcasts: { create: mocks.create, list: mocks.list, get: mocks.get },
  }
  return { resend, mocks }
}

const BROADCAST = {
  name: 'release-1.2.0',
  segmentId: 'seg_updates',
  topicId: 'topic_updates',
  subject: 'What is new',
  html: '<p>Hi</p>',
  scheduledAt: '2026-10-22T04:00:00.000Z',
}

describe('ResendBroadcaster.getTemplate', () => {
  it('returns the template with its variables and whether it is published', async () => {
    const { resend, mocks } = api({
      templateGet: jest.fn(() =>
        ok({
          subject: 'Hello {{{VERSION}}}',
          html: '<p>x</p>',
          status: 'published',
          variables: [
            { key: 'VERSION', fallback_value: null, type: 'string' },
            { key: 'TAGLINE', fallback_value: 'Run your gym', type: 'string' },
          ],
        })
      ),
    })
    const template = await new ResendBroadcaster(resend).getTemplate(
      'release-announcement'
    )
    expect(mocks.templateGet).toHaveBeenCalledWith(
      'release-announcement',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(template).toEqual({
      subject: 'Hello {{{VERSION}}}',
      html: '<p>x</p>',
      published: true,
      variables: [
        { key: 'VERSION', fallback: null },
        { key: 'TAGLINE', fallback: 'Run your gym' },
      ],
    })
  })

  it('reports a draft as unpublished', async () => {
    const { resend } = api({
      templateGet: jest.fn(() =>
        ok({ subject: null, html: '', status: 'draft', variables: null })
      ),
    })
    const template = await new ResendBroadcaster(resend).getTemplate('x')
    expect(template).toMatchObject({ published: false, variables: [] })
  })

  it('returns null when there is no such template', async () => {
    const { resend } = api({ templateGet: jest.fn(() => fail('not_found')) })
    expect(await new ResendBroadcaster(resend).getTemplate('x')).toBeNull()
  })

  it('throws on any other error', async () => {
    const { resend } = api({
      templateGet: jest.fn(() => fail('application_error', 'Resend is down')),
    })
    await expect(
      new ResendBroadcaster(resend).getTemplate('x')
    ).rejects.toThrow('Resend is down')
  })
})

describe('ResendBroadcaster.createBroadcast', () => {
  it('sends from the mailing address, scheduled, to the segment and topic given', async () => {
    const { resend, mocks } = api()
    const result = await new ResendBroadcaster(resend).createBroadcast(
      BROADCAST
    )
    expect(result).toEqual({ id: 'bc_1' })
    expect(mocks.create).toHaveBeenCalledWith(
      {
        name: 'release-1.2.0',
        segmentId: 'seg_updates',
        topicId: 'topic_updates',
        from: MAILING_FROM,
        replyTo: MAILING_REPLY_TO,
        subject: 'What is new',
        html: '<p>Hi</p>',
        send: true,
        scheduledAt: '2026-10-22T04:00:00.000Z',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('sends at once, with no topic, when told to', async () => {
    const { resend, mocks } = api()
    await new ResendBroadcaster(resend).createBroadcast({
      ...BROADCAST,
      topicId: null,
      scheduledAt: null,
    })
    const [payload] = mocks.create.mock.calls[0]
    expect(payload.send).toBe(true)
    expect(payload).not.toHaveProperty('scheduledAt')
    expect(payload.topicId).toBeNull()
  })

  it('throws when Resend refuses', async () => {
    const { resend } = api({
      create: jest.fn(() => fail('validation_error', 'Invalid segment')),
    })
    await expect(
      new ResendBroadcaster(resend).createBroadcast(BROADCAST)
    ).rejects.toThrow('Invalid segment')
  })
})

describe('ResendBroadcaster.findBroadcastByName', () => {
  it('pages through the broadcasts until it finds the name', async () => {
    const list = jest
      .fn()
      .mockReturnValueOnce(
        ok({
          data: [{ id: 'b1', name: 'other', scheduled_at: null }],
          has_more: true,
        })
      )
      .mockReturnValueOnce(
        ok({
          data: [
            {
              id: 'b2',
              name: 'release-1.2.0',
              scheduled_at: '2026-10-22 04:00:00+00',
            },
          ],
          has_more: false,
        })
      )
    const { resend } = api({ list })
    const found = await new ResendBroadcaster(resend).findBroadcastByName(
      'release-1.2.0'
    )
    expect(found).toEqual({ id: 'b2', scheduledAt: '2026-10-22T04:00:00.000Z' })
    expect(list).toHaveBeenLastCalledWith(
      { limit: 100, after: 'b1' },
      expect.anything()
    )
  })

  it('never takes the preview for the real broadcast', async () => {
    const { resend } = api({
      list: jest.fn(() =>
        ok({
          data: [
            { id: 'p', name: 'release-1.2.0-preview', scheduled_at: null },
          ],
          has_more: false,
        })
      ),
    })
    expect(
      await new ResendBroadcaster(resend).findBroadcastByName('release-1.2.0')
    ).toBeNull()
  })

  it('throws when the list cannot be read, so nothing is sent twice on a guess', async () => {
    const { resend } = api({ list: jest.fn(() => fail('application_error')) })
    await expect(
      new ResendBroadcaster(resend).findBroadcastByName('release-1.2.0')
    ).rejects.toThrow()
  })
})

describe('ResendBroadcaster.getBroadcastState', () => {
  it.each([
    ['sent', 'sent'],
    ['queued', 'scheduled'],
    ['scheduled', 'scheduled'],
    ['sending', 'scheduled'],
    ['canceled', 'canceled'],
    ['cancelled', 'canceled'],
    ['draft', 'canceled'],
    ['something-new', 'unknown'],
  ])('reads Resend status %s as %s', async (status, state) => {
    const { resend } = api({ get: jest.fn(() => ok({ status })) })
    expect(await new ResendBroadcaster(resend).getBroadcastState('b')).toBe(
      state
    )
  })
})
