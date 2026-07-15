/**
 * API Error Parsing Utility
 *
 * Provides centralized error message extraction from standardized API responses.
 * This utility ensures consistent error handling across all frontend components.
 *
 * @see src/core/utils/api/ApiResponse.ts - Backend response structure
 */

import { ApiErrorResponse } from '@/core/utils/api/ApiResponse';

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
  try {
    const data = (await response.json()) as ApiErrorResponse;

    // Handle validation errors with field-specific details
    if (
      data.error?.code === 'VALIDATION_ERROR' &&
      data.error?.details?.errors
    ) {
      const fieldErrors = data.error.details.errors as Record<string, string[]>;
      const formattedErrors = Object.entries(fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');

      return `Validation failed: ${formattedErrors}`;
    }

    // Extract message from standardized error response
    if (data.error?.message) {
      return data.error.message;
    }

    // Fallback to top-level message (legacy compatibility)
    if ('message' in data) {
      return (data as { message: string }).message;
    }

    // Last resort - use HTTP status text
    return `Request failed with status ${response.status}: ${response.statusText}`;
  } catch {
    // JSON parsing failed or response body already consumed
    return `Request failed with status ${response.status}: ${response.statusText}`;
  }
}
