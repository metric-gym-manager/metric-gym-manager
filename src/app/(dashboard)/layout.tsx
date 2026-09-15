import { headers } from 'next/headers'
import WorkspaceShell from '@/components/workspace/WorkspaceShell'
import { ViewportTierProvider } from '@/hooks/useViewportTier'
import { tierFromHeaders } from '@/utils/viewport/tierFromHeaders'
import { MemberModalProvider } from '@/contexts/member-modal.context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware already verified authentication and gym profile access.
  // The App Workspace shell (Enterprise UI/UX overhaul) provides the
  // collapsible sidebar, breadcrumb header and MemberLimitBar.
  //
  // The tier hint makes a phone's FIRST HTML the phone composition rather than
  // the desktop one corrected a frame later (mobile rebuild plan §4, risk
  // r02). It is a hint, not a decision: the client measures the real width on
  // its first commit and `useViewportTier` corrects anything this got wrong.
  //
  // Reading a request header opts this layout out of static rendering — it was
  // already dynamic, because everything beneath it reads the session.
  const requestHeaders = await headers()
  const initialTier = tierFromHeaders(
    requestHeaders.get('sec-ch-ua-mobile'),
    requestHeaders.get('user-agent')
  )

  return (
    <ViewportTierProvider initialTier={initialTier}>
      <WorkspaceShell>
        <MemberModalProvider>{children}</MemberModalProvider>
      </WorkspaceShell>
    </ViewportTierProvider>
  )
}
