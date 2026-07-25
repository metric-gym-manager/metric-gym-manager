import {
  updateAdmissionFeeSchema,
  updateGymPoliciesSchema,
} from '../schemas/settings.schemas'

describe('updateAdmissionFeeSchema', () => {
  it('accepts an enabled fee with a positive amount', () => {
    const result = updateAdmissionFeeSchema.safeParse({
      admission_fee: 1500,
      admission_fee_enabled: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a zero fee when disabled', () => {
    const result = updateAdmissionFeeSchema.safeParse({
      admission_fee: 0,
      admission_fee_enabled: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a negative fee', () => {
    const result = updateAdmissionFeeSchema.safeParse({
      admission_fee: -100,
      admission_fee_enabled: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-boolean enabled flag', () => {
    const result = updateAdmissionFeeSchema.safeParse({
      admission_fee: 100,
      admission_fee_enabled: 'yes',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateGymPoliciesSchema', () => {
  it('accepts rules and terms text', () => {
    const result = updateGymPoliciesSchema.safeParse({
      gym_rules: 'Be respectful.',
      gym_terms: 'Fees are non-refundable.',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty documents', () => {
    const result = updateGymPoliciesSchema.safeParse({
      gym_rules: '',
      gym_terms: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a document over the length limit', () => {
    const result = updateGymPoliciesSchema.safeParse({
      gym_rules: 'x'.repeat(20001),
      gym_terms: 'ok',
    })
    expect(result.success).toBe(false)
  })
})
