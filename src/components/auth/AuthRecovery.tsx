'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { isPublicRoute } from '@/lib/auth-config';
import {
  consumeAuthFailedFlag,
  enforceClientStateVersion,
  purgeSupabaseAuthCookies,
  purgeSupabaseLocalStorage,
  validateAndRepairAuthState,
} from '@/lib/client-state';

/**
 * Client-side state watchdog, mounted once in the root layout.
 *
 * On every app mount it:
 * 1. Invalidates local state written by an older deployment (version guard —
 *    purges stale localStorage/sessionStorage and zombie CacheStorage
 *    entries while preserving the Supabase session).
 * 2. Runs the JSON-parse catch-all over stored auth artifacts and wipes
 *    anything malformed before it can wedge the app (token/cookie rot).
 * 3. Consumes the "session expired" flag left by the middleware or a hard
 *    reset and tells the user what happened — once.
 * 4. Subscribes to Supabase auth state: on SIGNED_OUT it clears every local
 *    auth artifact and performs a single clean client-side redirect to
 *    /login. This is the client half of the server-to-frontend handshake
 *    that replaces server-side redirect bouncing.
 */
export function AuthRecovery() {
  useEffect(() => {
    void enforceClientStateVersion();
    validateAndRepairAuthState();

    if (consumeAuthFailedFlag()) {
      toast.error('Your session has expired. Please sign in again.');
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        purgeSupabaseAuthCookies();
        purgeSupabaseLocalStorage();
        if (!isPublicRoute(window.location.pathname)) {
          window.location.replace('/login');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
