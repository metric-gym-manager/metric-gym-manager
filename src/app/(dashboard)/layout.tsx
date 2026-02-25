import { redirect } from 'next/navigation';
import { getGymProfileForLayout } from '@/lib/middleware/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { MemberModalProvider } from '@/contexts/member-modal.context';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lightweight check — middleware already verified auth, this just ensures gym profile exists
  try {
    await getGymProfileForLayout();
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

        {/* Page content - Add top padding for mobile header and bottom padding for mobile nav */}
        <main className="px-4 py-6 lg:px-8 pt-16 lg:pt-6 pb-20 lg:pb-6">
          <MemberModalProvider>
            {children}
          </MemberModalProvider>
        </main>
      </div>
    </div>
  );
}
