import { addMemberSchema } from '../schemas/member.schemas'

const validBase = {
  name: 'John Doe',
  phoneNumber: '0771234567',
  planType: 'monthly' as const,
  planAmount: 5000,
  membershipStartDate: '2026-07-25',
  paymentAmount: 5000,
  acceptedTerms: true,
  acceptedGymRules: true,
}

describe('addMemberSchema — remarks & consents', () => {
  it('accepts a valid registration with both consents and remarks', () => {
    const result = addMemberSchema.safeParse({
      ...validBase,
      remarks: 'Prefers morning sessions',
    })
    expect(result.success).toBe(true)
  })

  it('treats remarks as optional', () => {
    const result = addMemberSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it('rejects remarks longer than 500 characters', () => {
    const result = addMemberSchema.safeParse({
      ...validBase,
      remarks: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects when the terms consent is not accepted', () => {
    const result = addMemberSchema.safeParse({
      ...validBase,
      acceptedTerms: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects when the gym-rules consent is not accepted', () => {
    const result = addMemberSchema.safeParse({
      ...validBase,
      acceptedGymRules: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects when consents are missing entirely', () => {
    const {
      acceptedTerms: _t,
      acceptedGymRules: _g,
      ...withoutConsents
    } = validBase
    const result = addMemberSchema.safeParse(withoutConsents)
    expect(result.success).toBe(false)
  })
})
