import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentGymProfile } from '@/lib/middleware/auth';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin Layout
 *
 * Restricts the SaaS system-health area to the single designated operator
 * account. Authorization is entirely server-side: the signed-in gym owner's
 * email must match ADMIN_ALLOWED_EMAIL (a server-only env var — never prefixed
 * NEXT_PUBLIC_, so no secret is ever shipped to the browser).
 *
 * Middleware already redirects unauthenticated visitors to /login before they
 * reach this layout; here we additionally send any non-operator account back to
 * their own dashboard. The admin API routes enforce the same check
 * independently (defense in depth).
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL;

  let gymProfile;
  try {
    gymProfile = await getCurrentGymProfile();
  } catch {
    redirect('/login');
  }

  // Fail closed: if the operator email is not configured, or the signed-in
  // account is not that operator, deny access.
  if (!allowedEmail || gymProfile.email !== allowedEmail) {
    redirect('/dashboard');
  }

  return (
    <div className="admin-layout">
      {/* Admin-specific header or navigation can go here */}
      {children}
    </div>
  );
}
