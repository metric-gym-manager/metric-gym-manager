import { createBrowserClient } from '@supabase/ssr'
import { AUTH_COOKIE_DOMAIN } from '@/lib/auth-config'
import {
  hardResetAuthState,
  isInvalidRefreshTokenError,
  validateAndRepairAuthState,
} from '@/lib/client-state'

type BrowserClient = ReturnType<typeof createBrowserClient>

let browserClient: BrowserClient | undefined

function isRefreshTokenRequest(url: string): boolean {
  return url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')
}

/** Normalize a GoTrue error body (old and new shapes) for the token guard. */
function normalizeAuthErrorBody(
  status: number,
  body: Record<string, unknown> | null
): { status: number; code?: string; message: string } | null {
  if (!body) return null
  const code =
    typeof body.error_code === 'string'
      ? body.error_code
      : typeof body.error === 'string'
        ? body.error
        : undefined
  const message =
    typeof body.msg === 'string'
      ? body.msg
      : typeof body.error_description === 'string'
        ? body.error_description
        : typeof body.message === 'string'
          ? body.message
          : ''
  return { status, code, message }
}

/**
 * Fetch wrapper that watches Supabase's token-refresh endpoint. When a
 * refresh request comes back 400/401 with an "Invalid Refresh Token" payload
 * the session is permanently dead: force a sign-out and wipe all local auth
 * files instead of letting the app wedge itself retrying a rotten token.
 */
function createAuthAwareFetch(): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init)

    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url

      if (
        isRefreshTokenRequest(url) &&
        (response.status === 400 || response.status === 401)
      ) {
        const body = (await response
          .clone()
          .json()
          .catch(() => null)) as Record<string, unknown> | null
        const normalized = normalizeAuthErrorBody(response.status, body)

        // `invalid_grant` on a refresh_token request always means the token
        // is dead, even when the description text varies.
        const refreshTokenDead =
          normalized !== null &&
          (normalized.code === 'invalid_grant' ||
            isInvalidRefreshTokenError(normalized))

        if (refreshTokenDead) {
          hardResetAuthState()
        }
      }
    } catch {
      // Diagnostics must never break the actual request.
    }

    return response
  }
}

export function createClient(): BrowserClient {
  const options = {
    // Scope auth cookies to an explicit host when configured, so staging and
    // production on sibling subdomains can't overwrite each other's session.
    ...(AUTH_COOKIE_DOMAIN
      ? { cookieOptions: { domain: AUTH_COOKIE_DOMAIN, path: '/' } }
      : {}),
    global: { fetch: createAuthAwareFetch() },
  }

  // On the server (SSR pass of client components) there is no shared state
  // to repair and no singleton to keep.
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      options
    )
  }

  if (!browserClient) {
    // Fail-safe init: wipe malformed cookies/localStorage tokens BEFORE the
    // client reads them, so a rotten value can never halt initialization.
    validateAndRepairAuthState()

    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      options
    )
  }

  return browserClient
}
