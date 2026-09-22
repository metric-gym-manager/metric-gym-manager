/**
 * Domain error → HTTP response, without leaking internals.
 *
 * `ResponseBuilder.fromError` returns the error's own message and stack for
 * anything it does not recognise, which is right for a developer-facing
 * surface and wrong for a gym manager: a Postgres message or a vendor return
 * code on their screen tells them nothing and exposes our internals (rules 2.8
 * / 2.9). This maps the known domain errors to their status codes and replaces
 * everything else with a fixed sentence, logging the real cause server-side
 * where the SaaS-admin health view can reach it.
 */

import { NextResponse } from 'next/server'
import { ResponseBuilder } from '@/utils/api/ApiResponse'

/**
 * Convert a caught error into a sanitized response.
 *
 * @param error - Whatever was thrown.
 * @param fallbackMessage - What to say when the error is not a known domain
 *   error. Should be plain language the reader can act on.
 * @param context - Optional label for the server log.
 *
 * @example
 * catch (err) {
 *   return toErrorResponse(err, 'Failed to load devices')
 * }
 */
/**
 * A request body that is not JSON at all.
 *
 * Its own type so that only a *body* syntax failure becomes a 400. Mapping
 * every `SyntaxError` would also catch one thrown while parsing something of
 * ours, and report our bug as the caller's mistake.
 */
export class MalformedJsonError extends Error {
  constructor(message = 'Request body is not valid JSON') {
    super(message)
    this.name = 'MalformedJsonError'
  }
}

/**
 * Parse a request body, turning unparseable input into a 400 rather than a 500.
 *
 * `request.json()` throws on malformed input, and a route that lets that reach
 * its outer catch answers 500 — telling the caller the server broke when in
 * fact they sent `{nope`. Beyond being wrong, it buries real faults in error
 * monitoring under noise anyone can generate.
 *
 * @param request - The incoming request.
 * @returns The parsed body, to be narrowed with a Zod schema by the caller.
 * @throws {MalformedJsonError} If the body is not valid JSON.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new MalformedJsonError()
  }
}

export function toErrorResponse(
  error: unknown,
  fallbackMessage: string,
  context?: string
): NextResponse {
  const name = error instanceof Error ? error.name : 'UnknownError'

  switch (name) {
    case 'MalformedJsonError':
      return NextResponse.json(
        ResponseBuilder.validationError({
          body: ['Request body is not valid JSON'],
        }),
        { status: 400 }
      )

    case 'ValidationError':
      return NextResponse.json(
        ResponseBuilder.validationError(
          (error as { errors?: Record<string, string[]> }).errors ?? {}
        ),
        { status: 400 }
      )

    case 'NotFoundError':
      return NextResponse.json(
        ResponseBuilder.notFound(
          (error as { resource?: string }).resource ?? 'Resource'
        ),
        { status: 404 }
      )

    case 'ConflictError':
      return NextResponse.json(
        ResponseBuilder.conflict((error as Error).message),
        { status: 409 }
      )

    case 'ForbiddenError':
      return NextResponse.json(
        ResponseBuilder.forbidden((error as Error).message),
        { status: 403 }
      )

    case 'UnauthorizedError':
      return NextResponse.json(
        ResponseBuilder.unauthorized((error as Error).message),
        { status: 401 }
      )

    default:
      // Everything else — database faults, vendor transport failures, bugs —
      // is logged in full and reported as one plain sentence.
      console.error(`${context ?? 'API error'}:`, error)
      return NextResponse.json(ResponseBuilder.internalError(fallbackMessage), {
        status: 500,
      })
  }
}
