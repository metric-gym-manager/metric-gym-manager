import WorkspaceShell from '@/components/workspace/WorkspaceShell'
import { MemberModalProvider } from '@/contexts/member-modal.context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware already verified authentication and gym profile access.
  // The App Workspace shell (Enterprise UI/UX overhaul) provides the
  // collapsible sidebar, breadcrumb header and MemberLimitBar.
  return (
    <WorkspaceShell>
      <MemberModalProvider>{children}</MemberModalProvider>
    </WorkspaceShell>
  )
}
