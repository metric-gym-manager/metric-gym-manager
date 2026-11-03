/**
 * API Error Parsing Utility
 *
 * Provides centralized error message extraction from standardized API responses.
 * This utility ensures consistent error handling across all frontend components.
 *
 * @see src/utils/api/ApiResponse.ts - Backend response structure
 */

import { ApiErrorResponse } from '@/utils/api/ApiResponse'

/**
 * Parse API error response and extract human-readable message
 *
 * This function handles the standardized error format returned by the backend:
 * {
 *   success: false,
 *   error: {
 *     message: string,
 *     code: string,
 *     details?: { errors?: Record<string, string[]> }
 *   }
 * }
 *
 * @param response - Fetch Response object (must not be ok)
 * @returns Human-readable error message string
 *
 * @example
 * // Basic usage
 * const res = await fetch('/api/members/123/payment', {...});
 * if (!res.ok) {
 *   const errorMessage = await parseApiError(res);
 *   throw new Error(errorMessage);
 * }
 *
 * @example
 * // Validation error with field details
 * // Backend returns: { error: { code: 'VALIDATION_ERROR', details: { errors: { email: ['Invalid format'] } } } }
 * // Returns: "Validation failed: email: Invalid format"
 */
export async function parseApiError(response: Response): Promise<string> {
  return messageFrom(await readBody(response), response)
}

/**
 * A failed API request that keeps what a caller may branch on — the
 * ResponseBuilder `error.code` (`MEMBER_LIMIT_REACHED`, `CONFLICT`, …) and the
 * HTTP status — beside its message. The one client-side API error: the
 * subscriptions client throws it too (re-exported there).
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly status: number = 500
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/**
 * Build an `ApiRequestError` from a failed response.
 *
 * @param response - Fetch Response object (must not be ok)
 * @returns The error for a mutation to throw
 *
 * @example
 * if (!res.ok) throw await toApiRequestError(res);
 * // in onError:
 * if (error instanceof ApiRequestError && error.code === 'MEMBER_LIMIT_REACHED') …
 */
export async function toApiRequestError(
  response: Response
): Promise<ApiRequestError> {
  const data = await readBody(response)
  const code = isObject(data) ? data.error?.code : undefined
  return new ApiRequestError(messageFrom(data, response), code, response.status)
}

/** The parsed body, or null when it is not JSON or was already read. */
async function readBody(response: Response): Promise<ApiErrorResponse | null> {
  try {
    return (await response.json()) as ApiErrorResponse
  } catch {
    return null
  }
}

function isObject(data: unknown): data is ApiErrorResponse {
  return typeof data === 'object' && data !== null
}

function messageFrom(data: unknown, response: Response): string {
  const statusLine = `Request failed with status ${response.status}: ${response.statusText}`

  // JSON parsing failed, the body was already consumed, or it is not an object
  if (!isObject(data)) {
    return statusLine
  }

  // Handle validation errors with field-specific details
  if (data.error?.code === 'VALIDATION_ERROR' && data.error?.details?.errors) {
    const fieldErrors = data.error.details.errors as Record<string, string[]>
    const formattedErrors = Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ')

    return `Validation failed: ${formattedErrors}`
  }

  // Extract message from standardized error response
  if (data.error?.message) {
    return data.error.message
  }

  // Fallback to top-level message (legacy compatibility)
  if ('message' in data) {
    return (data as { message: string }).message
  }

  // Last resort - use HTTP status text
  return statusLine
}
