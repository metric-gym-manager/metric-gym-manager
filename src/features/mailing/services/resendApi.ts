/**
 * What every Resend adapter in this feature shares: the SDK's result shape
 * and a time limit per request. The SDK never throws for an API error (it
 * returns `{ data, error }`) and applies no timeout of its own, so a stalled
 * Resend would otherwise hang the caller until the function is killed.
 */

/** The SDK's `{ data, error }` result; it never throws for an API error. */
export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: { name: string; message: string } }

/** Per-request options; the SDK aborts the request when `signal` fires. */
export type RequestOptions = { signal?: AbortSignal }

/** Long enough for Resend's slowest normal answer, short of a serverless timeout. */
export const DEFAULT_RESEND_TIMEOUT_MS = 8_000

export function isNotFound(error: { name: string } | null): boolean {
  return error?.name === 'not_found'
}

/** Options that abort the request after `timeoutMs`. */
export function timeLimit(timeoutMs: number): RequestOptions {
  return { signal: AbortSignal.timeout(timeoutMs) }
}
