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
export function toErrorResponse(
  error: unknown,
  fallbackMessage: string,
  context?: string
): NextResponse {
  const name = error instanceof Error ? error.name : 'UnknownError'

  switch (name) {
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
