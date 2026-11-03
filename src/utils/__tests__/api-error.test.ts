import { parseApiError } from '../api-error'
import { ResponseBuilder } from '../api/ApiResponse'

/** A failed `Response` carrying `body` as JSON, or an unparseable body. */
function failed(
  body: unknown,
  status = 500,
  statusText = 'Internal Server Error'
) {
  return {
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected token <')
      return body
    },
  } as unknown as Response
}

describe('parseApiError', () => {
  it('returns the message ResponseBuilder nests under error.message', async () => {
    const res = failed(
      ResponseBuilder.error('Member not found', 'NOT_FOUND'),
      404
    )
    await expect(parseApiError(res)).resolves.toBe('Member not found')
  })

  it('returns a conflict message untouched', async () => {
    const res = failed(
      ResponseBuilder.conflict('Phone number already in use'),
      409
    )
    await expect(parseApiError(res)).resolves.toBe(
      'Phone number already in use'
    )
  })

  it('spells out field errors for a validation failure', async () => {
    const res = failed(
      ResponseBuilder.validationError({ name: ['Too short', 'Required'] }),
      400
    )
    await expect(parseApiError(res)).resolves.toBe(
      'Validation failed: name: Too short, Required'
    )
  })

  it('falls back to the status line when the body is not JSON', async () => {
    await expect(parseApiError(failed(undefined))).resolves.toBe(
      'Request failed with status 500: Internal Server Error'
    )
  })

  it('never returns "[object Object]" for a nested error', async () => {
    const out = await parseApiError(
      failed({ success: false, error: { code: 'X' } })
    )
    expect(out).not.toContain('[object Object]')
  })

  // Documents a limit rather than endorsing it: routes that predate
  // ResponseBuilder send `{ error: 'text' }`, which this does not read. Those
  // call sites read `body.error` themselves and are correct as they stand.
  it('does not read a bare-string error envelope', async () => {
    const out = await parseApiError(
      failed({ error: 'Invalid password' }, 400, 'Bad Request')
    )
    expect(out).toBe('Request failed with status 400: Bad Request')
  })
})
