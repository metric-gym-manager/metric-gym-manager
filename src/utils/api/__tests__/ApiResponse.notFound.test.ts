import { ResponseBuilder } from '../ApiResponse'
import { NotFoundError } from '@/utils/errors'

/**
 * `notFound(resource)` appends " not found" itself, but callers pass three
 * different things: a noun ("Member"), a finished sentence ("Member not found")
 * and a `NotFoundError.message`, which already ends in " not found" because
 * that class appends it too. The sentence and the error message came out as
 * "Member not found not found".
 */
describe('ResponseBuilder.notFound', () => {
  const message = (resource: string) =>
    ResponseBuilder.notFound(resource).error.message

  it('appends the suffix to a plain noun', () => {
    expect(message('Member')).toBe('Member not found')
    expect(message('Registration link')).toBe('Registration link not found')
  })

  it('does not repeat the suffix when the caller already wrote it', () => {
    expect(message('Member not found')).toBe('Member not found')
  })

  it('does not repeat the suffix for a NotFoundError message', () => {
    expect(message(new NotFoundError('Member abc').message)).toBe(
      'Member abc not found'
    )
  })

  it('collapses a suffix that was already doubled upstream', () => {
    // `new NotFoundError('Member with ID x not found')` — a sentence handed to
    // a class that appends its own suffix — is "… not found not found".
    const doubled = new NotFoundError('Member with ID x not found').message
    expect(doubled).toBe('Member with ID x not found not found')
    expect(message(doubled)).toBe('Member with ID x not found')
  })

  it('ignores case and trailing whitespace on the suffix', () => {
    expect(message('Member Not Found  ')).toBe('Member not found')
  })

  it('keeps "not found" in the middle of a noun', () => {
    expect(message('Not found page')).toBe('Not found page not found')
  })

  it('still produces a message when the resource is only the suffix', () => {
    expect(message('not found')).toBe('Resource not found')
  })

  it('keeps the NOT_FOUND code', () => {
    expect(ResponseBuilder.notFound('Member').error.code).toBe('NOT_FOUND')
  })
})
