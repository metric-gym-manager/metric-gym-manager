import { Metadata } from 'next';
import CronStatusGrid from './CronStatusGrid';
import RawSMSFailureTable from './RawSMSFailureTable';
import BillingFailuresTable from './BillingFailuresTable';
import { Shield, Activity } from 'lucide-react';

export const metadata: Metadata = {
  title: 'System Health | Admin Dashboard',
  description: 'SaaS technical monitoring dashboard for system health and error tracking',
};

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Health Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Technical monitoring and error tracking for SaaS infrastructure
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Warning Banner */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Admin Dashboard - Restricted Access
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  This dashboard exposes technical infrastructure details including error messages,
                  stack traces, and system internals. This information is strictly for SaaS
                  administrators and must never be exposed to gym managers or end users.
                </p>
              </div>
            </div>
          </div>

          {/* Cron Status Grid */}
          <section>
            <CronStatusGrid />
          </section>

          {/* SMS Failures Table */}
          <section>
            <RawSMSFailureTable />
          </section>

          {/* PayHere Billing Failures Table */}
          <section>
            <BillingFailuresTable />
          </section>

          {/* Footer Info */}
          <div className="text-center text-sm text-gray-500 pt-4 pb-8">
            <p>
              Auto-refresh enabled (60s interval) • Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
