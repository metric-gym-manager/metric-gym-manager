import { redirect } from 'next/navigation';
import { getCurrentGymProfile } from '@/lib/middleware/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { MemberModalProvider } from '@/contexts/member-modal.context';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify authentication
  try {
    await getCurrentGymProfile();
  } catch (error) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Fixed on desktop */}
      <Sidebar />

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Header - Fetches gym profile via React Query for real-time updates */}
        <Header />

        {/* Page content */}
        <main className="px-4 py-6 lg:px-8">
          <MemberModalProvider>
            {children}
          </MemberModalProvider>
        </main>
      </div>
    </div>
  );
}
