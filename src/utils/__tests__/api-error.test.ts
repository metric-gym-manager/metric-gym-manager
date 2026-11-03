import { parseApiError, toApiRequestError, ApiRequestError } from '../api-error'
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

describe('toApiRequestError', () => {
  it('keeps the status and the machine-readable code beside the message', async () => {
    const err = await toApiRequestError(
      failed(
        ResponseBuilder.error(
          'Active member limit reached for current plan',
          'MEMBER_LIMIT_REACHED'
        ),
        403,
        'Forbidden'
      )
    )

    expect(err).toBeInstanceOf(ApiRequestError)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Active member limit reached for current plan')
    expect(err.status).toBe(403)
    expect(err.code).toBe('MEMBER_LIMIT_REACHED')
  })

  it('reads the message exactly as parseApiError does', async () => {
    const body = ResponseBuilder.validationError({ amount: ['Too small'] })

    const err = await toApiRequestError(failed(body, 400))

    expect(err.message).toBe(await parseApiError(failed(body, 400)))
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('keeps the status when the body is not JSON, with the default code', async () => {
    const err = await toApiRequestError(failed(undefined, 502, 'Bad Gateway'))

    expect(err.status).toBe(502)
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.message).toBe('Request failed with status 502: Bad Gateway')
  })
})

describe('toApiRequestError — the caller’s plain sentence', () => {
  it('uses the fallback when the body carries no message (a gateway page)', async () => {
    const err = await toApiRequestError(
      failed(undefined, 504, 'Gateway Timeout'),
      'Failed to collect payment'
    )

    expect(err.message).toBe('Failed to collect payment')
    expect(err.status).toBe(504)
  })

  it('prefers the server’s own message over the fallback', async () => {
    const err = await toApiRequestError(
      failed(ResponseBuilder.conflict('Someone else changed this.'), 409),
      'Failed to collect payment'
    )

    expect(err.message).toBe('Someone else changed this.')
  })
})
