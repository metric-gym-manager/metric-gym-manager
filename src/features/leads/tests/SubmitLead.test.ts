import { SubmitLead } from '../services/SubmitLead'
import type { ILeadRepository } from '../services/ILeadRepository'
import type { Lead, NewLead } from '../types'
import { LeadInterest } from '../config/LeadConfig'

/** In-memory repository capturing the last create() argument. */
class FakeLeadRepository implements ILeadRepository {
  public lastCreated: NewLead | null = null
  async create(lead: NewLead): Promise<Lead> {
    this.lastCreated = lead
    return {
      id: 'lead-1',
      ...lead,
      createdAt: '2026-07-26T00:00:00.000Z',
    }
  }
}

describe('SubmitLead', () => {
  const base = {
    name: 'Nuwan Perera',
    email: 'Nuwan@TitanFitness.LK',
    phone: '077 481 2290',
    interest: LeadInterest.Demo,
  }

  it('persists a lead and returns the stored row', async () => {
    const repo = new FakeLeadRepository()
    const lead = await new SubmitLead(repo).execute(base)
    expect(lead.id).toBe('lead-1')
    expect(repo.lastCreated).not.toBeNull()
  })

  it('lowercases the email and trims the name', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo).execute({ ...base, name: '  Nuwan Perera  ' })
    expect(repo.lastCreated?.email).toBe('nuwan@titanfitness.lk')
    expect(repo.lastCreated?.name).toBe('Nuwan Perera')
  })

  it('normalizes blank optional fields to null', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo).execute({ ...base, gymName: '   ', message: '' })
    expect(repo.lastCreated?.gymName).toBeNull()
    expect(repo.lastCreated?.message).toBeNull()
  })

  it('defaults the source to "landing"', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo).execute(base)
    expect(repo.lastCreated?.source).toBe('landing')
  })

  it('preserves a provided source', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo).execute({ ...base, source: 'pricing' })
    expect(repo.lastCreated?.source).toBe('pricing')
  })
})
