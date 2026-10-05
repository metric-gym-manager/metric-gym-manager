/**
 * @jest-environment node
 */
import { MailingAudience } from '../config/MailingConfig'
import type { IMailingList, NewMailingContact } from '../services/IMailingList'
import type { IMarketingSource } from '../services/IMarketingSource'
import { AddMarketingContact } from '../services/AddMarketingContact'
import { SyncMarketingContacts } from '../services/SyncMarketingContacts'

const SECRET = 'q'.repeat(64)

const source: IMarketingSource = {
  listGymOwners: async () => [
    { gymId: 'g1', email: 'owner@titan.lk', gymName: 'Titan Fitness' },
    { gymId: 'e2e', email: 'e2e@metric.test', gymName: 'E2E Lite' },
    { gymId: 'g3', email: 'Throwaway@Capitalistone.co', gymName: 'Throwaway' },
  ],
  listConsentingLeads: async () => [
    { email: 'nimal@example.lk', name: 'Nimal Perera', gymName: null },
    { email: 'NIMAL@example.lk', name: 'Nimal Perera', gymName: null },
    { email: 'broken@example.lk', name: 'Kasun', gymName: 'Iron Den' },
  ],
}

function fakeList(failFor?: string): IMailingList & {
  added: NewMailingContact[]
} {
  const added: NewMailingContact[] = []
  return {
    added,
    addContact: async (contact) => {
      if (contact.email === failFor) throw new Error('rate limited')
      added.push(contact)
      return 'created'
    },
    optOut: async () => undefined,
  }
}

function sync(list: IMailingList) {
  return new SyncMarketingContacts(
    source,
    new AddMarketingContact(list, SECRET)
  )
}

const exclusions = {
  excludeGymIds: ['e2e'],
  excludeEmails: ['throwaway@capitalistone.co'],
}

describe('SyncMarketingContacts', () => {
  it('plans without writing anything on a dry run', async () => {
    const list = fakeList()
    const report = await sync(list).execute({ apply: false, ...exclusions })
    expect(list.added).toHaveLength(0)
    expect(report.filter((r) => r.outcome === 'planned')).toEqual([
      {
        email: 'owner@titan.lk',
        audience: MailingAudience.GymOwners,
        outcome: 'planned',
      },
      {
        email: 'nimal@example.lk',
        audience: MailingAudience.DemoLeads,
        outcome: 'planned',
      },
      {
        email: 'broken@example.lk',
        audience: MailingAudience.DemoLeads,
        outcome: 'planned',
      },
    ])
  })

  it('excludes test gyms by id and by email, whatever the case', async () => {
    const report = await sync(fakeList()).execute({
      apply: false,
      ...exclusions,
    })
    expect(
      report.filter((r) => r.outcome === 'excluded').map((r) => r.email)
    ).toEqual(['e2e@metric.test', 'throwaway@capitalistone.co'])
  })

  it('adds owners and consenting leads to their audiences when applied', async () => {
    const list = fakeList()
    await sync(list).execute({ apply: true, ...exclusions })
    expect(list.added.map((c) => [c.email, c.audience, c.gymName])).toEqual([
      ['owner@titan.lk', MailingAudience.GymOwners, 'Titan Fitness'],
      ['nimal@example.lk', MailingAudience.DemoLeads, undefined],
      ['broken@example.lk', MailingAudience.DemoLeads, 'Iron Den'],
    ])
  })

  it('adds a lead who asked twice only once', async () => {
    const list = fakeList()
    await sync(list).execute({ apply: true, ...exclusions })
    expect(
      list.added.filter((c) => c.email === 'nimal@example.lk')
    ).toHaveLength(1)
  })

  it('records a failure and carries on with the rest', async () => {
    const list = fakeList('nimal@example.lk')
    const report = await sync(list).execute({ apply: true, ...exclusions })
    expect(report.find((r) => r.email === 'nimal@example.lk')).toEqual({
      email: 'nimal@example.lk',
      audience: MailingAudience.DemoLeads,
      outcome: 'failed',
      error: 'rate limited',
    })
    expect(list.added.map((c) => c.email)).toContain('broken@example.lk')
  })
})
