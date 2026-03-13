import { redirect } from 'next/navigation';

/**
 * Root dashboard route - redirects to /dashboard by default.
 * This ensures authenticated users land on the dashboard when visiting the root path.
 */
export default function RootDashboardPage() {
  redirect('/dashboard');
}
