import { createClient } from '@/lib/supabase/server';

/**
 * SaaS-admin (platform operator) authorization.
 *
 * Replaces the retired NEXT_PUBLIC_ADMIN_API_SECRET Bearer scheme: authorization
 * is the Supabase session plus membership in `saas_admins`. No secret is shipped
 * to the browser.
 *
 * The membership check runs under the CALLER'S session and relies on the
 * "Admins can read own admin row" RLS policy (`user_id = auth.uid()`): a
 * non-admin's select returns zero rows, so no service-role client is needed and
 * no user can enumerate the admin list.
 */
export interface SaasAdminUser {
  id: string;
  email: string | null;
}

/**
 * Returns the signed-in user iff they are a provisioned SaaS admin, else `null`.
 * Use in `/api/admin/*` route handlers (403 on `null`) and the `(admin)` layout
 * (redirect on `null`).
 */
export async function getSaasAdmin(): Promise<SaasAdminUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('saas_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  return { id: user.id, email: user.email ?? null };
}
