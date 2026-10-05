import { MailingTopic } from '../config/MailingConfig'
import { emailPreferencesSchema } from '../schemas/emailPreferences.schemas'

describe('emailPreferencesSchema', () => {
  const valid = {
    email: 'owner@titanfitness.lk',
    token: 'abc_DEF-123',
    topics: [MailingTopic.Marketing],
  }

  it('accepts one or both topics', () => {
    expect(emailPreferencesSchema.safeParse(valid).success).toBe(true)
    expect(
      emailPreferencesSchema.safeParse({
        ...valid,
        topics: [MailingTopic.Marketing, MailingTopic.Updates],
      }).success
    ).toBe(true)
  })

  it('rejects an empty choice', () => {
    expect(
      emailPreferencesSchema.safeParse({ ...valid, topics: [] }).success
    ).toBe(false)
  })

  it('rejects a topic that does not exist', () => {
    expect(
      emailPreferencesSchema.safeParse({ ...valid, topics: ['billing'] })
        .success
    ).toBe(false)
  })

  it('rejects a missing token or email', () => {
    expect(
      emailPreferencesSchema.safeParse({ ...valid, token: '' }).success
    ).toBe(false)
    expect(
      emailPreferencesSchema.safeParse({ ...valid, email: '' }).success
    ).toBe(false)
  })

  it('rejects a token with characters a signed token never has', () => {
    expect(
      emailPreferencesSchema.safeParse({ ...valid, token: 'abc def' }).success
    ).toBe(false)
  })

  it('removes duplicate topics', () => {
    const parsed = emailPreferencesSchema.parse({
      ...valid,
      topics: [MailingTopic.Updates, MailingTopic.Updates],
    })
    expect(parsed.topics).toEqual([MailingTopic.Updates])
  })
})
