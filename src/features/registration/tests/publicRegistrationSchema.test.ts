import { publicRegistrationSchema } from '../schemas/registration.schemas'

const validBase = {
  token: 'a'.repeat(32),
  name: 'Jane Doe',
  phoneNumber: '0771234567',
  planType: 'monthly',
  acceptedTerms: true,
  acceptedGymRules: true,
}

describe('publicRegistrationSchema — consents', () => {
  it('accepts a valid self-registration with both consents', () => {
    const result = publicRegistrationSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it('rejects when the terms consent is not accepted', () => {
    const result = publicRegistrationSchema.safeParse({
      ...validBase,
      acceptedTerms: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects when the gym-rules consent is not accepted', () => {
    const result = publicRegistrationSchema.safeParse({
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
    const result = publicRegistrationSchema.safeParse(withoutConsents)
    expect(result.success).toBe(false)
  })
})
