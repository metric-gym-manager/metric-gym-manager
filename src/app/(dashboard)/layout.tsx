import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { MemberLimitBar } from '@/features/subscriptions';
import { MemberModalProvider } from '@/contexts/member-modal.context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already verified authentication and gym profile access
  // No need for redundant server-side checks that block layout rendering
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Fixed on desktop */}
      <Sidebar />

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Header - Fetches gym profile via React Query for real-time updates */}
        <Header />

        {/* Starter usage: remaining member slots + universal upgrade CTA.
            Shows Starter (40) and Growth (190) usage; hides for Enterprise/comped and under /settings. */}
        <MemberLimitBar />

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
