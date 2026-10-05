/**
 * @jest-environment node
 */
import {
  MailingAudience,
  MailingTopic,
  RESEND_SEGMENT_IDS,
  RESEND_TOPIC_IDS,
} from '../config/MailingConfig'
import {
  ResendMailingList,
  type MailingContactsApi,
} from '../services/ResendMailingList'

type Call = [string, unknown]

/** A Resend contacts API double: one optional existing contact. */
function api(options: {
  existing?: { token?: string; segments: string[] }
  failWith?: string
}) {
  const calls: Call[] = []
  const notFound = {
    data: null,
    error: { name: 'not_found', message: 'Contact not found' },
  }
  const ok = <T>(data: T) => ({ data, error: null })
  const fail = () => ({
    data: null,
    error: { name: 'application_error', message: options.failWith ?? '' },
  })
  const fake: MailingContactsApi = {
    get: async (o) => {
      calls.push(['get', o])
      if (options.failWith) return fail()
      if (!options.existing) return notFound
      const token = options.existing.token
      const properties: Record<string, { type: 'string'; value: string }> =
        token ? { unsubscribe_token: { type: 'string', value: token } } : {}
      return ok({ id: 'contact-1', properties })
    },
    create: async (o) => {
      calls.push(['create', o])
      return ok({ id: 'contact-1' })
    },
    update: async (o) => {
      calls.push(['update', o])
      return ok({ id: 'contact-1' })
    },
    topics: {
      update: async (o) => {
        calls.push(['topics.update', o])
        if (options.failWith) return fail()
        return options.existing ? ok({ id: 'contact-1' }) : notFound
      },
    },
    segments: {
      list: async (o) => {
        calls.push(['segments.list', o])
        const ids = options.existing?.segments ?? []
        return ok({ data: ids.map((id) => ({ id })), has_more: false })
      },
      add: async (o) => {
        calls.push(['segments.add', o])
        return ok({ id: 'contact-1' })
      },
    },
  }
  return { fake, calls, names: () => calls.map(([n]) => n) }
}

const contact = {
  email: 'owner@titanfitness.lk',
  firstName: 'Nuwan',
  gymName: 'Titan Fitness',
  audience: MailingAudience.GymOwners,
  unsubscribeToken: 'tok-1',
}

describe('ResendMailingList.addContact', () => {
  it('creates a new contact in the audience with its token and gym name', async () => {
    const { fake, calls } = api({})
    await expect(new ResendMailingList(fake).addContact(contact)).resolves.toBe(
      'created'
    )
    const created = calls.find(([n]) => n === 'create')?.[1]
    expect(created).toEqual({
      email: 'owner@titanfitness.lk',
      firstName: 'Nuwan',
      properties: { gym_name: 'Titan Fitness', unsubscribe_token: 'tok-1' },
      segments: [{ id: RESEND_SEGMENT_IDS[MailingAudience.GymOwners] }],
    })
  })

  it('creates without subscription fields, so topic defaults (opt-in) apply', async () => {
    const { fake, calls } = api({})
    await new ResendMailingList(fake).addContact(contact)
    const created = calls.find(([n]) => n === 'create')?.[1] as Record<
      string,
      unknown
    >
    expect(created).not.toHaveProperty('topics')
    expect(created).not.toHaveProperty('unsubscribed')
  })

  it('leaves an existing contact in the audience untouched', async () => {
    const segment = RESEND_SEGMENT_IDS[MailingAudience.GymOwners]
    const { fake, names } = api({
      existing: { token: 'tok-1', segments: [segment] },
    })
    await expect(new ResendMailingList(fake).addContact(contact)).resolves.toBe(
      'unchanged'
    )
    expect(names()).toEqual(['get', 'segments.list'])
  })

  it('adds an existing contact to a new audience without touching its topics', async () => {
    const { fake, calls, names } = api({
      existing: {
        token: 'tok-1',
        segments: [RESEND_SEGMENT_IDS[MailingAudience.DemoLeads]],
      },
    })
    await expect(new ResendMailingList(fake).addContact(contact)).resolves.toBe(
      'added_to_audience'
    )
    expect(names()).not.toContain('topics.update')
    expect(names()).not.toContain('create')
    expect(calls.find(([n]) => n === 'segments.add')?.[1]).toEqual({
      email: 'owner@titanfitness.lk',
      segmentId: RESEND_SEGMENT_IDS[MailingAudience.GymOwners],
    })
  })

  it('writes the token onto an existing contact that lacks it, and nothing else', async () => {
    const segment = RESEND_SEGMENT_IDS[MailingAudience.GymOwners]
    const { fake, calls } = api({ existing: { segments: [segment] } })
    await new ResendMailingList(fake).addContact(contact)
    expect(calls.find(([n]) => n === 'update')?.[1]).toEqual({
      email: 'owner@titanfitness.lk',
      properties: { unsubscribe_token: 'tok-1' },
    })
  })

  it('throws on a provider error other than not-found', async () => {
    const { fake } = api({ failWith: 'rate limited' })
    await expect(
      new ResendMailingList(fake).addContact(contact)
    ).rejects.toThrow('rate limited')
  })
})

describe('ResendMailingList.optOut', () => {
  it('opts out of the chosen topics only', async () => {
    const { fake, calls } = api({ existing: { segments: [] } })
    await new ResendMailingList(fake).optOut('owner@titanfitness.lk', [
      MailingTopic.Updates,
    ])
    expect(calls).toEqual([
      [
        'topics.update',
        {
          email: 'owner@titanfitness.lk',
          topics: [
            {
              id: RESEND_TOPIC_IDS[MailingTopic.Updates],
              subscription: 'opt_out',
            },
          ],
        },
      ],
    ])
  })

  it('never sets the global unsubscribe flag', async () => {
    const { fake, names } = api({ existing: { segments: [] } })
    await new ResendMailingList(fake).optOut('owner@titanfitness.lk', [
      MailingTopic.Marketing,
      MailingTopic.Updates,
    ])
    expect(names()).toEqual(['topics.update'])
  })

  it('treats a contact that does not exist as already opted out', async () => {
    const { fake } = api({})
    await expect(
      new ResendMailingList(fake).optOut('gone@gym.lk', [
        MailingTopic.Marketing,
      ])
    ).resolves.toBeUndefined()
  })

  it('throws on any other provider error', async () => {
    const { fake } = api({ existing: { segments: [] }, failWith: 'boom' })
    await expect(
      new ResendMailingList(fake).optOut('owner@titanfitness.lk', [
        MailingTopic.Marketing,
      ])
    ).rejects.toThrow('boom')
  })
})
