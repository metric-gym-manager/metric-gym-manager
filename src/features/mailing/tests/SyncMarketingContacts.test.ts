/**
 * @jest-environment node
 */
import { MailingAudience, MailingTopic } from '../config/MailingConfig'
import { AddMarketingContact } from '../services/AddMarketingContact'
import type {
  ConsentingLeadRecipient,
  GymOwnerRecipient,
  IMarketingSource,
} from '../services/IMarketingSource'
import {
  SyncMarketingContacts,
  type SyncMarketingContactsOptions,
} from '../services/SyncMarketingContacts'
import { MemoryMailingList } from './memoryMailingList'

const SECRET = 'q'.repeat(64)
const { Marketing: MKT, ProductUpdates: UPD } = MailingAudience

function source(
  gyms: GymOwnerRecipient[],
  leads: ConsentingLeadRecipient[] = []
): IMarketingSource {
  return {
    listGymOwners: async () => gyms,
    listConsentingLeads: async () => leads,
    listKnownEmails: async () => [
      ...gyms.map((g) => g.email),
      ...leads.map((l) => l.email),
    ],
  }
}

const gym = (
  gymId: string,
  email: string,
  subscriptionStatus = 'active',
  gymName = `Gym ${gymId}`
): GymOwnerRecipient => ({ gymId, email, gymName, subscriptionStatus })

const run = (
  list: MemoryMailingList,
  src: IMarketingSource,
  options: Partial<SyncMarketingContactsOptions> = {}
) =>
  new SyncMarketingContacts(
    src,
    list,
    new AddMarketingContact(list, SECRET)
  ).execute({
    apply: true,
    excludeGymIds: [],
    excludeEmails: [],
    ...options,
  })

describe('SyncMarketingContacts — who is on which list', () => {
  it('puts a current gym in both audiences and a cancelled or suspended one in Marketing only', async () => {
    const list = new MemoryMailingList()
    await run(
      list,
      source([
        gym('g1', 'active@gym.lk', 'active'),
        gym('g2', 'trial@gym.lk', 'trialing'),
        gym('g3', 'overdue@gym.lk', 'past_due'),
        gym('g4', 'cancelled@gym.lk', 'canceled'),
        gym('g5', 'suspended@gym.lk', 'suspended'),
      ])
    )
    expect(list.audiencesOf('active@gym.lk')).toEqual([MKT, UPD])
    expect(list.audiencesOf('trial@gym.lk')).toEqual([MKT, UPD])
    expect(list.audiencesOf('overdue@gym.lk')).toEqual([MKT, UPD])
    expect(list.audiencesOf('cancelled@gym.lk')).toEqual([MKT])
    expect(list.audiencesOf('suspended@gym.lk')).toEqual([MKT])
  })

  it('stores the gym id on gym contacts and lowercases new addresses', async () => {
    const list = new MemoryMailingList()
    await run(list, source([gym('g1', 'Owner@Titan.LK')]))
    expect(list.contacts.get('owner@titan.lk')?.gymId).toBe('g1')
  })

  it('puts a consenting lead in Marketing only', async () => {
    const list = new MemoryMailingList()
    await run(
      list,
      source(
        [],
        [{ email: 'nimal@example.lk', name: 'Nimal Perera', gymName: null }]
      )
    )
    expect(list.audiencesOf('nimal@example.lk')).toEqual([MKT])
  })

  it('keeps one contact for a gym owner who was also a lead', async () => {
    const list = new MemoryMailingList()
    await run(
      list,
      source(
        [gym('g1', 'owner@titan.lk')],
        [{ email: 'OWNER@titan.lk', name: 'Nuwan', gymName: null }]
      )
    )
    expect([...list.contacts.keys()]).toEqual(['owner@titan.lk'])
    expect(list.audiencesOf('owner@titan.lk')).toEqual([MKT, UPD])
  })
})

describe('SyncMarketingContacts — following the gyms', () => {
  it('moves a gym to its new address, carrying its opt-outs, and deletes the old contact', async () => {
    const list = new MemoryMailingList().seed('old@titan.lk', {
      gymId: 'g1',
      audiences: [MKT, UPD],
      optOut: [MailingTopic.Marketing],
    })
    const report = await run(list, source([gym('g1', 'new@titan.lk')]))
    expect(list.contacts.has('old@titan.lk')).toBe(false)
    expect(list.audiencesOf('new@titan.lk')).toEqual([MKT, UPD])
    expect([...(list.contacts.get('new@titan.lk')?.optOut ?? [])]).toEqual([
      MailingTopic.Marketing,
    ])
    expect(report).toContainEqual(
      expect.objectContaining({
        email: 'new@titan.lk',
        action: 'move',
        outcome: 'done',
      })
    )
  })

  it('copies the opt-outs before deleting the old address, so none are lost', async () => {
    const list = new MemoryMailingList().seed('old@titan.lk', {
      gymId: 'g1',
      audiences: [MKT],
      optOut: [MailingTopic.Updates],
    })
    await run(list, source([gym('g1', 'new@titan.lk')]))
    const optOut = list.writes.findIndex((w) =>
      w.startsWith('opt-out:new@titan.lk')
    )
    const remove = list.writes.indexOf('delete:old@titan.lk')
    expect(optOut).toBeGreaterThan(-1)
    expect(optOut).toBeLessThan(remove)
  })

  it('takes a gym that cancelled out of Product updates, leaving Marketing and its topics alone', async () => {
    const list = new MemoryMailingList().seed('owner@titan.lk', {
      gymId: 'g1',
      audiences: [MKT, UPD],
      optOut: [MailingTopic.Marketing],
    })
    await run(list, source([gym('g1', 'owner@titan.lk', 'canceled')]))
    expect(list.audiencesOf('owner@titan.lk')).toEqual([MKT])
    expect([...(list.contacts.get('owner@titan.lk')?.optOut ?? [])]).toEqual([
      MailingTopic.Marketing,
    ])
  })

  it('puts a reactivated gym back in Product updates', async () => {
    const list = new MemoryMailingList().seed('owner@titan.lk', {
      gymId: 'g1',
      audiences: [MKT],
    })
    await run(list, source([gym('g1', 'owner@titan.lk', 'active')]))
    expect(list.audiencesOf('owner@titan.lk')).toEqual([MKT, UPD])
  })

  it('takes an address that belongs to no gym or lead off both lists, without deleting it', async () => {
    const list = new MemoryMailingList().seed('gone@gym.lk', {
      gymId: 'deleted-gym',
      audiences: [MKT, UPD],
    })
    await run(list, source([]))
    expect(list.audiencesOf('gone@gym.lk')).toEqual([])
    expect(list.contacts.has('gone@gym.lk')).toBe(true)
  })

  it('matches a member stored with capitals instead of duplicating it', async () => {
    const list = new MemoryMailingList().seed('Owner@Titan.lk', {
      gymId: 'g1',
      audiences: [MKT],
    })
    await run(list, source([gym('g1', 'owner@titan.lk', 'active')]))
    expect([...list.contacts.keys()]).toEqual(['Owner@Titan.lk'])
    expect(list.audiencesOf('Owner@Titan.lk')).toEqual([MKT, UPD])
  })

  it('does nothing on a second run (steady state)', async () => {
    const list = new MemoryMailingList()
    const src = source([
      gym('g1', 'a@gym.lk'),
      gym('g2', 'b@gym.lk', 'canceled'),
    ])
    await run(list, src)
    list.writes.length = 0
    const report = await run(list, src)
    expect(list.writes).toEqual([])
    expect(report.filter((r) => r.outcome !== 'excluded')).toEqual([])
  })
})

describe('SyncMarketingContacts — exclusions, dry runs and failures', () => {
  it('never adds an excluded gym or email, and takes one already listed off', async () => {
    const list = new MemoryMailingList().seed('test@capitalistone.co', {
      gymId: 'g9',
      audiences: [MKT, UPD],
    })
    await run(
      list,
      source([
        gym('g9', 'test@capitalistone.co'),
        gym('e2e', 'e2e@gym.lk'),
        gym('g1', 'real@gym.lk'),
      ]),
      { excludeGymIds: ['g9', 'e2e'] }
    )
    expect(list.audiencesOf('test@capitalistone.co')).toEqual([])
    expect(list.contacts.has('e2e@gym.lk')).toBe(false)
    expect(list.audiencesOf('real@gym.lk')).toEqual([MKT, UPD])
  })

  it('excludes by email, whatever the case', async () => {
    const list = new MemoryMailingList()
    await run(list, source([gym('g1', 'Throwaway@Capitalistone.co')]), {
      excludeEmails: ['throwaway@capitalistone.co'],
    })
    expect(list.contacts.size).toBe(0)
  })

  it('never imports an address at a reserved, undeliverable TLD', async () => {
    const list = new MemoryMailingList()
    const report = await run(
      list,
      source([
        gym('d1', 'demo-sms@gymmanagement.local'),
        gym('d2', 'e2e-lite@metricgym.test'),
        gym('d3', 'someone@example.invalid'),
        gym('d4', 'owner@example'),
        gym('d5', 'dev@app.localhost'),
        gym('g1', 'owner@titan.lk'),
      ])
    )
    expect([...list.contacts.keys()]).toEqual(['owner@titan.lk'])
    expect(report.filter((r) => r.outcome === 'excluded')).toHaveLength(5)
  })

  it('plans without writing on a dry run, moves included', async () => {
    const list = new MemoryMailingList().seed('old@titan.lk', {
      gymId: 'g1',
      audiences: [MKT, UPD],
    })
    const report = await run(
      list,
      source([gym('g1', 'new@titan.lk'), gym('g2', 'b@gym.lk', 'canceled')]),
      { apply: false }
    )
    expect(list.writes).toEqual([])
    expect(report.map((r) => [r.action, r.email, r.outcome])).toEqual([
      ['move', 'new@titan.lk', 'planned'],
      ['add', 'b@gym.lk', 'planned'],
    ])
  })

  it('records a failure and carries on with the rest', async () => {
    const list = new MemoryMailingList()
    list.failFor.add('broken@gym.lk')
    const report = await run(
      list,
      source([gym('g1', 'broken@gym.lk'), gym('g2', 'fine@gym.lk')])
    )
    expect(report).toContainEqual(
      expect.objectContaining({
        email: 'broken@gym.lk',
        outcome: 'failed',
        error: 'rate limited',
      })
    )
    expect(list.audiencesOf('fine@gym.lk')).toEqual([MKT, UPD])
  })
})
