import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from '@/lib/auth-config'

interface CreateClientOptions {
  /** Override the "remember me" preference for this client instance.
   *  When omitted, falls back to reading the `remember_session` cookie. */
  rememberSession?: boolean
}

export async function createClient(opts?: CreateClientOptions) {
  const cookieStore = await cookies()

  // Determine whether the session should persist across browser restarts.
  // An explicit value (passed during login) takes priority; otherwise we
  // read the preference cookie that was set at login time.
  const rememberSession =
    opts?.rememberSession ??
    cookieStore.get(REMEMBER_ME_COOKIE)?.value === '1'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: Array<{
            name: string
            value: string
            options: CookieOptions
          }>
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Build cookie options — strip any upstream maxAge so we
              // control persistence entirely via the rememberSession flag.
              const cookieOpts: Record<string, unknown> = {
                ...options,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              }

              if (rememberSession) {
                cookieOpts.maxAge = REMEMBER_ME_MAX_AGE
              } else {
                // Session cookie — expires when the browser closes.
                delete cookieOpts.maxAge
              }

              cookieStore.set(name, value, cookieOpts)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
