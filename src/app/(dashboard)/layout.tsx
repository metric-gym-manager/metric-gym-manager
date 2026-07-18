import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { MemberLimitBar } from '@/features/subscriptions'
import { MemberModalProvider } from '@/contexts/member-modal.context'
import {
  CommandPaletteProvider,
  CommandPalette,
} from '@/components/command-palette'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware already verified authentication and gym profile access
  // No need for redundant server-side checks that block layout rendering
  return (
    // CommandPaletteProvider wraps the whole shell so the Header trigger and
    // the palette dialog share one open state (and the global ⌘K listener).
    <CommandPaletteProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Sidebar - Fixed on desktop */}
        <Sidebar />

        {/* Main content area */}
        <div className="lg:pl-64">
          {/* Header - Fetches gym profile via React Query for real-time updates */}
          <Header />

          {/* Member usage: remaining active-member slots + universal upgrade CTA.
              Shows for Lite (100, the only capped tier); Pro/Enterprise are
              uncapped — hidden for them, for comped subs and under /settings. */}
          <MemberLimitBar />

          {/* Page content - Add top padding for mobile header and bottom padding for mobile nav */}
          <main className="px-4 py-6 lg:px-8 pt-16 lg:pt-6 pb-20 lg:pb-6">
            <MemberModalProvider>
              {children}
              {/* Palette lives inside MemberModalProvider so a selected member
                  opens through the same modal the rest of the app uses. */}
              <CommandPalette />
            </MemberModalProvider>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  )
}
