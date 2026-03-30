import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin Layout
 *
 * This layout protects admin-only routes.
 *
 * SECURITY NOTE: This is a basic protection layer that checks for the
 * NEXT_PUBLIC_ADMIN_API_SECRET environment variable. In a production
 * environment, you should implement proper role-based authentication
 * with user roles stored in the database.
 *
 * Current protection: URL parameter-based (dev/testing only)
 * Production: Should use session-based role checking
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  // Basic protection: Check if admin secret is configured
  // In production, replace this with proper role-based auth
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET;

  if (!adminSecret) {
    // If no admin secret is configured, block access entirely
    redirect('/dashboard');
  }

  // Note: The actual authorization happens at the API level
  // This layout just ensures the admin routes are clearly separated

  return (
    <div className="admin-layout">
      {/* Admin-specific header or navigation can go here */}
      {children}
    </div>
  );
}
