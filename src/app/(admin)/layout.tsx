import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSaasAdmin } from '@/lib/auth/requireSaasAdmin';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin Layout — real authorization gate for SaaS-operator routes.
 *
 * Access requires a Supabase session (enforced by middleware) AND membership in
 * the `saas_admins` allow-list. A signed-in non-admin is bounced to their
 * dashboard; an unauthenticated visitor is already redirected to /login by
 * middleware before reaching here.
 *
 * This replaces the previous NEXT_PUBLIC_ADMIN_API_SECRET existence check, which
 * only verified the secret was configured (not that the *viewer* was authorized)
 * and shipped that secret to every browser via the client bundle.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const admin = await getSaasAdmin();

  if (!admin) {
    redirect('/dashboard');
  }

  return <div className="admin-layout">{children}</div>;
}
