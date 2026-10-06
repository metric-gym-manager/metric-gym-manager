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
  /** A provider that answers success and changes nothing. */
  ignoreTopicWrites?: boolean
}) {
  const calls: Call[] = []
  const signals: (AbortSignal | undefined)[] = []
  const reads: unknown[] = []
  const written = new Map<string, 'opt_in' | 'opt_out'>()
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
    get: async (o, r) => {
      calls.push(['get', o])
      signals.push(r?.signal)
      if (options.failWith) return fail()
      if (!options.existing) return notFound
      const token = options.existing.token
      const properties: Record<string, { type: 'string'; value: string }> =
        token ? { unsubscribe_token: { type: 'string', value: token } } : {}
      return ok({ id: 'contact-1', properties })
    },
    create: async (o, r) => {
      calls.push(['create', o])
      signals.push(r?.signal)
      return ok({ id: 'contact-1' })
    },
    update: async (o, r) => {
      calls.push(['update', o])
      signals.push(r?.signal)
      return ok({ id: 'contact-1' })
    },
    topics: {
      update: async (o, r) => {
        calls.push(['topics.update', o])
        signals.push(r?.signal)
        if (options.failWith) return fail()
        if (!options.existing) return notFound
        if (!options.ignoreTopicWrites) {
          for (const t of o.topics) written.set(t.id, t.subscription)
        }
        return ok({ id: 'contact-1' })
      },
      list: async (o, r) => {
        reads.push(o)
        signals.push(r?.signal)
        const data = Object.values(RESEND_TOPIC_IDS).map((id) => ({
          id,
          subscription: written.get(id) ?? ('opt_in' as const),
        }))
        return ok({ data, has_more: false })
      },
    },
    list: async () => ok({ data: [], has_more: false }),
    remove: async () => ok({ id: 'contact-1' }),
    segments: {
      remove: async () => ok({ id: 'contact-1' }),
      list: async (o, r) => {
        calls.push(['segments.list', o])
        signals.push(r?.signal)
        const ids = options.existing?.segments ?? []
        return ok({ data: ids.map((id) => ({ id })), has_more: false })
      },
      add: async (o, r) => {
        calls.push(['segments.add', o])
        signals.push(r?.signal)
        return ok({ id: 'contact-1' })
      },
    },
  }
  return { fake, calls, signals, reads, names: () => calls.map(([n]) => n) }
}

const contact = {
  email: 'owner@titanfitness.lk',
  firstName: 'Nuwan',
  gymName: 'Titan Fitness',
  audience: MailingAudience.ProductUpdates,
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
      segments: [{ id: RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates] }],
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
    const segment = RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates]
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
        segments: [RESEND_SEGMENT_IDS[MailingAudience.Marketing]],
      },
    })
    await expect(new ResendMailingList(fake).addContact(contact)).resolves.toBe(
      'added_to_audience'
    )
    expect(names()).not.toContain('topics.update')
    expect(names()).not.toContain('create')
    expect(calls.find(([n]) => n === 'segments.add')?.[1]).toEqual({
      email: 'owner@titanfitness.lk',
      segmentId: RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates],
    })
  })

  it('writes the token onto an existing contact that lacks it, and nothing else', async () => {
    const segment = RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates]
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

/**
 * Findings of the inverted check of 2026-10-06, each a defect found against
 * the live Resend API rather than this double (docs/architecture/
 * marketing-email-inverted-check.md).
 */
describe('ResendMailingList — inverted-check findings', () => {
  const owners = RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates]

  it('F3: never overwrites a token signed with another secret, and reports it', async () => {
    const { fake, names } = api({
      existing: { token: 'tok-OLD', segments: [owners] },
    })
    await expect(new ResendMailingList(fake).addContact(contact)).resolves.toBe(
      'token_mismatch'
    )
    expect(names()).not.toContain('update')
  })

  it('F3: still adds a mismatched contact to the new audience', async () => {
    const { fake, names } = api({
      existing: {
        token: 'tok-OLD',
        segments: [RESEND_SEGMENT_IDS[MailingAudience.Marketing]],
      },
    })
    await expect(new ResendMailingList(fake).addContact(contact)).resolves.toBe(
      'token_mismatch'
    )
    expect(names()).toContain('segments.add')
  })

  it('F3: rewrites the token only when asked to rotate', async () => {
    const { fake, calls } = api({
      existing: { token: 'tok-OLD', segments: [owners] },
    })
    await expect(
      new ResendMailingList(fake, { rotateTokens: true }).addContact(contact)
    ).resolves.toBe('unchanged')
    expect(calls.find(([n]) => n === 'update')?.[1]).toEqual({
      email: 'owner@titanfitness.lk',
      properties: { unsubscribe_token: 'tok-1' },
    })
  })

  it('F1: gives every provider call a time limit', async () => {
    const { fake, signals } = api({})
    await new ResendMailingList(fake).addContact(contact)
    await new ResendMailingList(fake).optOut('owner@titanfitness.lk', [
      MailingTopic.Marketing,
    ])
    expect(signals.length).toBeGreaterThan(0)
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal)
  })

  /** A provider that never answers, but honours an abort like fetch does. */
  function hanging(): MailingContactsApi {
    const never = <T>(r?: { signal?: AbortSignal }) =>
      new Promise<T>((_, reject) =>
        r?.signal?.addEventListener('abort', () => reject(r.signal?.reason))
      )
    return {
      get: (_o, r) => never(r),
      create: (_o, r) => never(r),
      update: (_o, r) => never(r),
      topics: { update: (_o, r) => never(r), list: (_o, r) => never(r) },
      list: (_o, r) => never(r),
      remove: (_o, r) => never(r),
      segments: {
        list: (_o, r) => never(r),
        add: (_o, r) => never(r),
        remove: (_o, r) => never(r),
      },
    }
  }

  it('F1: gives up on an add that never answers', async () => {
    await expect(
      new ResendMailingList(hanging(), { timeoutMs: 20 }).addContact(contact)
    ).rejects.toBeDefined()
  })

  it('F1: gives up on an opt-out that never answers', async () => {
    await expect(
      new ResendMailingList(hanging(), { timeoutMs: 20 }).optOut(
        'owner@titanfitness.lk',
        [MailingTopic.Marketing]
      )
    ).rejects.toBeDefined()
  })
})

/**
 * Read-back confirmation (inverted check, 2026-10-06). Topic writes take
 * 1–2.5 s to read back, and a write that cannot be confirmed must surface as
 * an error rather than a "Done". (An early probe read too soon and concluded
 * Resend ignores writes for mixed-case contacts; a timeline disproved it —
 * see docs/architecture/marketing-email-inverted-check.md, F2b.)
 */
describe('ResendMailingList.optOut — read-back confirmation', () => {
  const fast = { confirmAttempts: 3, confirmDelayMs: 0 }

  it('confirms the opt-out by reading it back', async () => {
    const { fake, reads } = api({ existing: { segments: [] } })
    await expect(
      new ResendMailingList(fake, fast).optOut('owner@titanfitness.lk', [
        MailingTopic.Marketing,
      ])
    ).resolves.toBeUndefined()
    expect(reads.length).toBeGreaterThan(0)
  })

  it('fails loudly when the provider reports success but nothing changed', async () => {
    const { fake } = api({
      existing: { segments: [] },
      ignoreTopicWrites: true,
    })
    await expect(
      new ResendMailingList(fake, fast).optOut('Owner@TitanFitness.lk', [
        MailingTopic.Marketing,
      ])
    ).rejects.toThrow(/not confirmed/i)
  })

  it('waits for a write that takes a moment to read back', async () => {
    const { fake } = api({ existing: { segments: [] } })
    let lagging = 2
    const slow: MailingContactsApi = {
      ...fake,
      topics: {
        update: fake.topics.update,
        list: async (o, r) => {
          const result = await fake.topics.list(o, r)
          if (lagging-- > 0 && result.data) {
            return {
              data: {
                ...result.data,
                data: result.data.data.map((t) => ({
                  ...t,
                  subscription: 'opt_in' as const,
                })),
              },
              error: null,
            }
          }
          return result
        },
      },
    }
    await expect(
      new ResendMailingList(slow, {
        confirmAttempts: 4,
        confirmDelayMs: 0,
      }).optOut('owner@titanfitness.lk', [MailingTopic.Updates])
    ).resolves.toBeUndefined()
  })
})

/**
 * The reconcile's reads and removals (owner decision 2026-10-06: the list
 * follows each gym's status and email).
 */
describe('ResendMailingList — reconcile operations', () => {
  type Row = { id: string; email: string }

  /** A Resend contacts API over an in-memory store of contacts and memberships. */
  function store(seed: {
    contacts: { email: string; gymId?: string; optOut?: string[] }[]
    members: Record<string, string[]>
    pageSize?: number
  }) {
    const contacts = new Map(seed.contacts.map((c) => [c.email, { ...c }]))
    const members = new Map(
      Object.entries(seed.members).map(([s, e]) => [s, [...e]])
    )
    const calls: string[] = []
    const ok = <T>(data: T) => ({ data, error: null })
    const notFound = {
      data: null,
      error: { name: 'not_found', message: 'Contact not found' },
    }
    const page = seed.pageSize ?? 100
    const fake = {
      ...api({}).fake,
      get: async ({ email }: { email: string }) => {
        const c = contacts.get(email)
        if (!c) return notFound
        const properties: Record<string, { type: 'string'; value: string }> =
          c.gymId ? { gym_id: { type: 'string', value: c.gymId } } : {}
        return ok({ id: email, properties })
      },
      list: async (o: {
        segmentId: string
        limit?: number
        after?: string
      }) => {
        calls.push(`list:${o.after ?? 'start'}`)
        const all: Row[] = (members.get(o.segmentId) ?? []).map((email) => ({
          id: `id-${email}`,
          email,
        }))
        const from = o.after ? all.findIndex((r) => r.id === o.after) + 1 : 0
        const data = all.slice(from, from + page)
        return ok({ data, has_more: from + page < all.length })
      },
      remove: async ({ email }: { email: string }) => {
        calls.push(`remove:${email}`)
        return contacts.delete(email) ? ok({ id: email }) : notFound
      },
      topics: {
        update: async () => ok({ id: 'x' }),
        list: async ({ email }: { email: string }) => {
          const c = contacts.get(email)
          if (!c) return notFound
          const data = Object.values(RESEND_TOPIC_IDS).map((id) => ({
            id,
            subscription: c.optOut?.includes(id)
              ? ('opt_out' as const)
              : ('opt_in' as const),
          }))
          return ok({ data, has_more: false })
        },
      },
      segments: {
        list: async () => ok({ data: [], has_more: false }),
        add: async () => ok({ id: 'x' }),
        remove: async (o: { email: string; segmentId: string }) => {
          calls.push(`segment-remove:${o.email}`)
          const list = members.get(o.segmentId) ?? []
          if (!list.includes(o.email)) return notFound
          members.set(
            o.segmentId,
            list.filter((e) => e !== o.email)
          )
          return ok({ id: o.email })
        },
      },
    } as MailingContactsApi
    return { fake, contacts, members, calls }
  }

  const MKT = RESEND_SEGMENT_IDS[MailingAudience.Marketing]
  const UPD = RESEND_SEGMENT_IDS[MailingAudience.ProductUpdates]

  it('lists every member of an audience across pages, as stored', async () => {
    const emails = ['A@x.lk', 'b@x.lk', 'c@x.lk', 'd@x.lk', 'e@x.lk']
    const { fake, calls } = store({
      contacts: [],
      members: { [MKT]: emails },
      pageSize: 2,
    })
    await expect(
      new ResendMailingList(fake).listAudience(MailingAudience.Marketing)
    ).resolves.toEqual(emails)
    expect(calls.filter((c) => c.startsWith('list:'))).toHaveLength(3)
  })

  it('removes a contact from one audience only', async () => {
    const { fake, members } = store({
      contacts: [{ email: 'a@x.lk' }],
      members: { [MKT]: ['a@x.lk'], [UPD]: ['a@x.lk'] },
    })
    await new ResendMailingList(fake).removeFromAudience(
      'a@x.lk',
      MailingAudience.ProductUpdates
    )
    expect(members.get(UPD)).toEqual([])
    expect(members.get(MKT)).toEqual(['a@x.lk'])
  })

  it('treats removing a non-member as done', async () => {
    const { fake } = store({ contacts: [], members: {} })
    await expect(
      new ResendMailingList(fake).removeFromAudience(
        'nobody@x.lk',
        MailingAudience.Marketing
      )
    ).resolves.toBeUndefined()
  })

  it("reads a contact's gym id, or null when it has none or does not exist", async () => {
    const { fake } = store({
      contacts: [{ email: 'a@x.lk', gymId: 'gym-1' }, { email: 'b@x.lk' }],
      members: {},
    })
    const list = new ResendMailingList(fake)
    await expect(list.getGymId('a@x.lk')).resolves.toBe('gym-1')
    await expect(list.getGymId('b@x.lk')).resolves.toBeNull()
    await expect(list.getGymId('gone@x.lk')).resolves.toBeNull()
  })

  it('reads the kinds of email a contact opted out of', async () => {
    const { fake } = store({
      contacts: [
        { email: 'a@x.lk', optOut: [RESEND_TOPIC_IDS[MailingTopic.Marketing]] },
      ],
      members: {},
    })
    await expect(
      new ResendMailingList(fake).optedOutTopics('a@x.lk')
    ).resolves.toEqual([MailingTopic.Marketing])
  })

  it('deletes a contact, and treats one already gone as done', async () => {
    const { fake, contacts } = store({
      contacts: [{ email: 'a@x.lk' }],
      members: {},
    })
    const list = new ResendMailingList(fake)
    await list.deleteContact('a@x.lk')
    expect(contacts.has('a@x.lk')).toBe(false)
    await expect(list.deleteContact('a@x.lk')).resolves.toBeUndefined()
  })

  it("writes a gym contact's gym id when creating it", async () => {
    const { fake, calls } = api({})
    await new ResendMailingList(fake).addContact({ ...contact, gymId: 'gym-9' })
    const created = calls.find(([n]) => n === 'create')?.[1] as {
      properties: Record<string, string>
    }
    expect(created.properties.gym_id).toBe('gym-9')
  })
})
