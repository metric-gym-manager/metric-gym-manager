/**
 * @jest-environment node
 */
import { MailingAudience } from '../config/MailingConfig'
import { MailingUnavailableError } from '../services/errors'
import { MemoryMailingList } from './memoryMailingList'
import { AddMarketingContact } from '../services/AddMarketingContact'
import { verifyUnsubscribeToken } from '../utils/unsubscribeToken'

const SECRET = 'k'.repeat(64)

function fakeList(): MemoryMailingList {
  return new MemoryMailingList()
}

describe('AddMarketingContact', () => {
  it('adds the contact with a token that verifies for its email', async () => {
    const list = fakeList()
    const result = await new AddMarketingContact(list, SECRET).execute({
      email: 'Owner@TitanFitness.LK',
      gymName: 'Titan Fitness',
      audience: MailingAudience.ProductUpdates,
    })
    expect(result).toBe('created')
    const [added] = list.added
    expect(added.email).toBe('owner@titanfitness.lk')
    expect(added.gymName).toBe('Titan Fitness')
    expect(added.audience).toBe(MailingAudience.ProductUpdates)
    expect(
      verifyUnsubscribeToken(added.email, added.unsubscribeToken, SECRET)
    ).toBe(true)
  })

  it('uses the first word of a full name as the first name', async () => {
    const list = fakeList()
    await new AddMarketingContact(list, SECRET).execute({
      email: 'nimal@example.lk',
      name: '  Nimal Perera ',
      audience: MailingAudience.Marketing,
    })
    expect(list.added[0].firstName).toBe('Nimal')
  })

  it('omits blank names and gym names', async () => {
    const list = fakeList()
    await new AddMarketingContact(list, SECRET).execute({
      email: 'nimal@example.lk',
      name: '   ',
      gymName: '',
      audience: MailingAudience.Marketing,
    })
    expect(list.added[0].firstName).toBeUndefined()
    expect(list.added[0].gymName).toBeUndefined()
  })

  it('reports unavailable when no provider or secret is configured', async () => {
    const input = { email: 'a@b.lk', audience: MailingAudience.Marketing }
    await expect(
      new AddMarketingContact(null, SECRET).execute(input)
    ).rejects.toBeInstanceOf(MailingUnavailableError)
    await expect(
      new AddMarketingContact(fakeList(), null).execute(input)
    ).rejects.toBeInstanceOf(MailingUnavailableError)
  })
})
