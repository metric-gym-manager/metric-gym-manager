import { Metadata } from 'next'
import CronStatusGrid from './CronStatusGrid'
import RawSMSFailureTable from './RawSMSFailureTable'
import BillingFailuresTable from './BillingFailuresTable'
import { Activity } from 'lucide-react'
import { Alert } from '@/components/ui'
import { PageHeader } from '@/components/common/composites'

export const metadata: Metadata = {
  title: 'System Health | Admin Dashboard',
  description:
    'SaaS technical monitoring dashboard for system health and error tracking',
}

/**
 * System Health Dashboard
 *
 * This is a SaaS admin-only page for monitoring system infrastructure.
 * It displays:
 * 1. Cron job execution status and history
 * 2. SMS delivery failures with full error traces
 *
 * SECURITY NOTE: This page exposes technical infrastructure details
 * (error messages, stack traces, database errors) that are intentionally
 * hidden from gym managers. Access must be strictly controlled.
 *
 * Access Control: the (admin) layout gates this route on a Supabase session +
 * saas_admins membership; the /api/admin/* routes enforce the same server-side.
 * No admin secret is shipped to the browser.
 */
export default function SystemHealthPage() {
  return (
    <div className="flex max-w-app flex-col gap-6">
      <PageHeader
        title="System health"
        description="Technical monitoring and error tracking for SaaS infrastructure"
      />

      <Alert variant="warning" icon={<Activity />} title="Restricted access">
        This dashboard exposes technical infrastructure details including error
        messages, stack traces and system internals. It is for SaaS
        administrators only and must never be shown to gym managers or end
        users.
      </Alert>

      <CronStatusGrid />
      <RawSMSFailureTable />
      <BillingFailuresTable />

      <p className="pt-2 font-mono text-mono-sm text-ink-muted">
        Auto-refresh 60s · last updated {new Date().toLocaleTimeString()}
      </p>
    </div>
  )
}
