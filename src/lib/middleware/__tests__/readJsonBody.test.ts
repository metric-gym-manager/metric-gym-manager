/**
 * @jest-environment node
 */

/**
 * Malformed input is the caller's mistake, not ours.
 *
 * A route that lets `request.json()` throw into its outer catch answers 500 —
 * telling a gym manager the server broke when they sent `{nope`, and burying
 * real faults in error monitoring under noise anyone can generate. Found by
 * campaign case VAL-22 against a live route.
 */

import {
  MalformedJsonError,
  readJsonBody,
  toErrorResponse,
} from '@/lib/middleware/apiErrors'

const request = (body: string) =>
  ({ json: async () => JSON.parse(body) }) as unknown as Request

describe('readJsonBody', () => {
  it('returns the parsed body when it is JSON', async () => {
    expect(await readJsonBody(request('{"a":1}'))).toEqual({ a: 1 })
  })

  it('throws a named error when the body is not JSON', async () => {
    await expect(readJsonBody(request('{nope'))).rejects.toThrow(
      MalformedJsonError
    )
  })

  it('answers 400, not 500', async () => {
    const response = toErrorResponse(new MalformedJsonError(), 'Failed')

    expect(response.status).toBe(400)
  })

  it('does not turn every SyntaxError into a 400', async () => {
    // Only a *body* syntax failure is the caller's fault. A SyntaxError thrown
    // while parsing something of ours is our bug, and reporting it as 400
    // would blame the caller and hide it.
    const response = toErrorResponse(new SyntaxError('internal'), 'Failed')

    expect(response.status).toBe(500)
  })
})
