import { updateMemberSchema } from '../schemas/member.schemas'

/**
 * The entity trims a name and refuses anything under two characters afterwards,
 * but the request schema counted the untrimmed text. " a" passed validation and
 * then failed inside the entity as a plain Error, which the route reported as a
 * 500 "Failed to update member" instead of a 400 the form can show.
 */
describe('updateMemberSchema — name', () => {
  it('trims surrounding whitespace', () => {
    const parsed = updateMemberSchema.parse({ name: '  Nimal Perera  ' })
    expect(parsed.name).toBe('Nimal Perera')
  })

  it.each([' a', 'a ', '   ', ' \t'])(
    'refuses %j: fewer than two characters once trimmed',
    (name) => {
      const result = updateMemberSchema.safeParse({ name })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Name must be at least 2 characters'
        )
      }
    }
  )

  it('accepts a name that is two characters after trimming', () => {
    expect(updateMemberSchema.parse({ name: ' Jo ' }).name).toBe('Jo')
  })

  it('still allows the name to be left out', () => {
    expect(updateMemberSchema.parse({}).name).toBeUndefined()
  })
})
