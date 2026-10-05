import { SubmitLead } from '../services/SubmitLead'
import type { ILeadRepository } from '../services/ILeadRepository'
import type { ILeadNotifier } from '../services/ILeadNotifier'
import type { Lead, LeadNotificationOutcome, NewLead } from '../types'
import { LeadInterest } from '../config/LeadConfig'

/** In-memory repository capturing the last create() and outcome. */
class FakeLeadRepository implements ILeadRepository {
  public lastCreated: NewLead | null = null
  public outcome: { id: string; outcome: LeadNotificationOutcome } | null = null
  public failRecording = false
  async create(lead: NewLead): Promise<Lead> {
    this.lastCreated = lead
    return {
      id: 'lead-1',
      ...lead,
      createdAt: '2026-07-26T00:00:00.000Z',
    }
  }
  async recordNotification(
    id: string,
    outcome: LeadNotificationOutcome
  ): Promise<void> {
    if (this.failRecording) throw new Error('database unavailable')
    this.outcome = { id, outcome }
  }
}

/** Resolves (or rejects) on a later macrotask, like a real SMTP round trip. */
function notifier(result: 'sent' | Error): ILeadNotifier & { calls: Lead[] } {
  const calls: Lead[] = []
  return {
    calls,
    notify: (lead) =>
      new Promise((resolve, reject) =>
        setTimeout(() => {
          calls.push(lead)
          if (result === 'sent') resolve()
          else reject(result)
        }, 0)
      ),
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
    const lead = await new SubmitLead(repo, null).execute(base)
    expect(lead.id).toBe('lead-1')
    expect(repo.lastCreated).not.toBeNull()
  })

  it('lowercases the email and trims the name', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo, null).execute({
      ...base,
      name: '  Nuwan Perera  ',
    })
    expect(repo.lastCreated?.email).toBe('nuwan@titanfitness.lk')
    expect(repo.lastCreated?.name).toBe('Nuwan Perera')
  })

  it('normalizes blank optional fields to null', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo, null).execute({
      ...base,
      gymName: '   ',
      message: '',
    })
    expect(repo.lastCreated?.gymName).toBeNull()
    expect(repo.lastCreated?.message).toBeNull()
  })

  it('defaults the source to "landing"', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo, null).execute(base)
    expect(repo.lastCreated?.source).toBe('landing')
  })

  it('preserves a provided source', async () => {
    const repo = new FakeLeadRepository()
    await new SubmitLead(repo, null).execute({ ...base, source: 'pricing' })
    expect(repo.lastCreated?.source).toBe('pricing')
  })

  /**
   * Each demo request is emailed to hello@metricgymos.com (owner decision,
   * 2026-10-05): before this, a stored request was seen by nobody. The email
   * is awaited (a serverless function may be frozen once it responds) and its
   * outcome recorded on the row; a failed email never fails the request.
   */
  describe('emailing the lead', () => {
    it('emails the stored lead and records when, before returning', async () => {
      const repo = new FakeLeadRepository()
      const mail = notifier('sent')
      const lead = await new SubmitLead(repo, mail).execute(base)

      expect(mail.calls).toEqual([lead])
      expect(repo.outcome?.id).toBe('lead-1')
      expect(repo.outcome?.outcome).toEqual({ notifiedAt: expect.any(Date) })
    })

    it('records a failed email and still returns the lead', async () => {
      const repo = new FakeLeadRepository()
      const mail = notifier(
        new Error('Invalid login: 535 5.7.8 BadCredentials')
      )
      const lead = await new SubmitLead(repo, mail).execute(base)

      expect(lead.id).toBe('lead-1')
      expect(repo.outcome?.outcome).toEqual({
        error: expect.stringContaining('535'),
      })
    })

    it('records that email is not configured when no sender is set up', async () => {
      const repo = new FakeLeadRepository()
      await new SubmitLead(repo, null).execute(base)
      expect(repo.outcome?.outcome).toEqual({
        error: expect.stringMatching(/not configured/i),
      })
    })

    it('keeps a recorded error short', async () => {
      const repo = new FakeLeadRepository()
      const mail = notifier(new Error('x'.repeat(2000)))
      await new SubmitLead(repo, mail).execute(base)
      const outcome = repo.outcome?.outcome
      expect(outcome && 'error' in outcome && outcome.error.length).toBe(500)
    })

    it('does not fail the request when the outcome cannot be recorded', async () => {
      const repo = new FakeLeadRepository()
      repo.failRecording = true
      const lead = await new SubmitLead(repo, notifier('sent')).execute(base)
      expect(lead.id).toBe('lead-1')
    })
  })
})
