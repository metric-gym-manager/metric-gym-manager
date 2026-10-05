import { createLeadSchema } from '../schemas/lead.schemas'
import { LeadInterest } from '../config/LeadConfig'

describe('createLeadSchema', () => {
  const valid = {
    name: 'Nuwan Perera',
    email: 'nuwan@titanfitness.lk',
    phone: '077 481 2290',
    interest: LeadInterest.Demo,
  }

  it('accepts a valid minimal lead', () => {
    const result = createLeadSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts optional gymName and message', () => {
    const result = createLeadSchema.safeParse({
      ...valid,
      gymName: 'Titan Fitness',
      message: 'We have ~300 members and want to move off spreadsheets.',
    })
    expect(result.success).toBe(true)
  })

  // Honeypot: a filled `website` means a bot — must be rejected.
  it('rejects a submission with the honeypot filled', () => {
    const result = createLeadSchema.safeParse({
      ...valid,
      website: 'http://spam.example',
    })
    expect(result.success).toBe(false)
  })

  it('allows an empty honeypot value', () => {
    const result = createLeadSchema.safeParse({ ...valid, website: '' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = createLeadSchema.safeParse({
      ...valid,
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid phone number', () => {
    const result = createLeadSchema.safeParse({ ...valid, phone: 'call me' })
    expect(result.success).toBe(false)
  })

  it('rejects a too-short name', () => {
    const result = createLeadSchema.safeParse({ ...valid, name: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects an interest outside the enum', () => {
    const result = createLeadSchema.safeParse({
      ...valid,
      interest: 'partnership',
    })
    expect(result.success).toBe(false)
  })

  it('treats a missing marketing consent as no consent', () => {
    expect(createLeadSchema.parse(valid).marketingConsent).toBe(false)
  })

  it('accepts a ticked marketing consent box', () => {
    expect(
      createLeadSchema.parse({ ...valid, marketingConsent: true })
        .marketingConsent
    ).toBe(true)
  })

  it('rejects a marketing consent that is not a boolean', () => {
    expect(
      createLeadSchema.safeParse({ ...valid, marketingConsent: 'yes' }).success
    ).toBe(false)
  })
})
