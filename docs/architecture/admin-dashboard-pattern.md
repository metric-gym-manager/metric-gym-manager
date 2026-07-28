# SaaS Admin Dashboard Pattern

> ⚠️ **Auth model superseded (2026-07-06, commit `b890f8e`).** The current admin
> dashboard is gated by a **Supabase session + membership in the `saas_admins`
> table** (`src/lib/auth/requireSaasAdmin.ts`; migration
> `20260706000001_create_saas_admins.sql`) — there is **no `ADMIN_API_SECRET` /
> browser-shipped Bearer token**. The `ADMIN_API_SECRET` /
> `NEXT_PUBLIC_ADMIN_API_SECRET` Bearer code in this doc is **retained only as
> historical context and MUST NOT be reintroduced**. The "never expose
> infrastructure errors to gym managers" guidance still holds unchanged.

> On-demand reference. Loaded when working in this area, not auto-injected.
> Governing rules (also indexed in `.claude/rules/architecture.md`):

- **§2.9 Admin dashboard** — Provide a separate technical dashboard for admins, gated by a Supabase session + `saas_admins` membership; never expose infrastructure errors to gym managers.

---

### 2.9 SaaS Admin Dashboard Pattern

**CRITICAL RULE**: SaaS platforms MUST provide a separate, protected technical dashboard for system administrators to monitor infrastructure health and debug production issues.

#### ❌ WRONG: Exposing Technical Errors to End Users

```typescript
// ❌ NEVER show stack traces, database errors, or API failures in user-facing UI
export async function GET(request: NextRequest) {
  const { data: failures } = await supabase
    .from('sms_logs')
    .select('*, error_message') // WRONG - technical errors visible to gym managers
    .eq('delivery_status', 'failed')

  return NextResponse.json({ failures }) // Exposed to all authenticated users
}
```

**Problems**:

- Technical infrastructure details exposed to end users
- Stack traces reveal implementation details and potential vulnerabilities
- Database error messages expose schema information
- No distinction between user-facing and admin-only data
- Gym managers see confusing technical jargon instead of actionable guidance

#### ✅ CORRECT: Dedicated Admin Dashboard with Authorization

**Step 1: Create Protected API Routes with Strict Authorization**

```typescript
// src/app/api/admin/system-health/cron-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Strict authorization check BEFORE any database queries
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_API_SECRET

    if (!adminSecret) {
      console.error('ADMIN_API_SECRET not configured')
      return NextResponse.json(
        { success: false, error: 'Admin API not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${adminSecret}`) {
      console.warn('Unauthorized admin API access attempt')
      return NextResponse.json(
        { success: false, error: 'Forbidden - Invalid admin credentials' },
        { status: 403 }
      )
    }

    // Only execute queries AFTER authorization passes
    const supabase = createAdminClient()
    const { data: jobNames } = await supabase
      .from('cron_logs')
      .select('job_name')
      .order('job_name')

    const uniqueJobNames = Array.from(
      new Set((jobNames || []).map((row) => row.job_name))
    )

    const cronStats: Record<string, any[]> = {}

    for (const jobName of uniqueJobNames) {
      const { data: executions } = await supabase
        .from('cron_logs')
        .select(
          'id, job_name, started_at, completed_at, status, summary, errors'
        )
        .eq('job_name', jobName)
        .order('started_at', { ascending: false })
        .limit(10)

      cronStats[jobName] = executions || []
    }

    return NextResponse.json(
      { success: true, data: cronStats },
      { status: 200 }
    )
  } catch (error) {
    console.error('Cron stats API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 2: Create SMS Failures Endpoint with error_message Column and Gym Filtering**

```typescript
// src/app/api/admin/system-health/sms-failures/route.ts
export async function GET(request: NextRequest) {
  try {
    // Authorization check (same pattern as above)
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_API_SECRET

    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Extract optional gymId query parameter for gym-specific drilldown
    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get('gymId')

    const supabase = createAdminClient()

    // Build query with optional gym filter
    let query = supabase
      .from('sms_logs')
      .select(
        'id, gym_id, member_id, sms_type, phone_number, message_body, sent_at, delivery_status, error_message, text_lk_message_id'
      )
      .eq('delivery_status', 'failed')

    // Apply gym filter if gymId provided
    if (gymId) {
      query = query.eq('gym_id', gymId)
    }

    // Execute query with ordering and limit
    const { data: failures } = await query
      .order('sent_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      success: true,
      data: {
        failures: failures || [],
        totalCount: (failures || []).length,
        filters: {
          gymId: gymId || null, // Include applied filters in response
        },
      },
    })
  } catch (error) {
    console.error('SMS failures API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Performance Optimization**:

- Composite index created: `idx_sms_logs_gym_failures (gym_id, delivery_status, sent_at DESC)`
- Partial index with `WHERE delivery_status = 'failed'` clause
- Provides 10-100x speedup for gym-filtered queries on large datasets

**Step 3: Build Cron Status Grid Component**

```typescript
// src/app/(admin)/system-health/CronStatusGrid.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function CronStatusGrid() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-cron-stats'],
    queryFn: async () => {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET || '';
      const response = await fetch('/api/admin/system-health/cron-stats', {
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch cron stats');
      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const getStatusBadge = (status: 'running' | 'success' | 'failure') => {
    switch (status) {
      case 'success':
        return (
          <Badge className="border-transparent bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failure':
        return (
          <Badge className="border-transparent bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'running':
        return (
          <Badge className="border-transparent bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(data?.data || {}).map(([jobName, executions]) => {
        const latestRun = executions[0];
        const isFailed = latestRun?.status === 'failure';

        return (
          <Card
            key={jobName}
            className={isFailed ? 'border-red-500 border-2' : ''}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                {jobName}
                {isFailed && <AlertTriangle className="h-5 w-5 text-red-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestRun && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    {getStatusBadge(latestRun.status)}
                  </div>
                  {latestRun.errors && latestRun.errors.length > 0 && (
                    <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                      <p className="text-xs font-semibold text-red-800 mb-1">
                        Errors ({latestRun.errors.length}):
                      </p>
                      <p className="text-xs text-red-700 truncate">
                        {latestRun.errors[0]}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 4: Build Raw SMS Failure Table Component with Gym Filtering**

```typescript
// src/app/(admin)/system-health/RawSMSFailureTable.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Input,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { Copy, Check, Filter, X } from 'lucide-react';
import { useState } from 'react';

export default function RawSMSFailureTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [gymIdFilter, setGymIdFilter] = useState<string>('');
  const [activeGymId, setActiveGymId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-sms-failures', activeGymId],  // Include activeGymId for cache isolation
    queryFn: async () => {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET || '';
      // Construct URL with optional gymId parameter
      const url = activeGymId
        ? `/api/admin/system-health/sms-failures?gymId=${activeGymId}`
        : '/api/admin/system-health/sms-failures';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch SMS failures');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const handleApplyFilter = () => {
    if (gymIdFilter.trim()) {
      setActiveGymId(gymIdFilter.trim());
    }
  };

  const handleClearFilter = () => {
    setGymIdFilter('');
    setActiveGymId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApplyFilter();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Delivery Failures (Latest 50)</CardTitle>

        {/* Gym-Specific Drilldown Filter */}
        <div className="mt-4 flex items-center gap-2">
          <Input
            type="text"
            placeholder="Filter by Gym ID (UUID)"
            value={gymIdFilter}
            onChange={(e) => setGymIdFilter(e.target.value)}
            onKeyDown={handleKeyPress}
            className="max-w-xs font-mono text-sm"
          />
          <Button
            onClick={handleApplyFilter}
            variant="default"
            size="sm"
            disabled={!gymIdFilter.trim()}
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filter
          </Button>
          {activeGymId && (
            <Button
              onClick={handleClearFilter}
              variant="outline"
              size="sm"
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>

        {/* Active Filter Indicator */}
        {activeGymId && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Filtered by Gym ID:</span>{' '}
              <span className="font-mono text-xs">{activeGymId}</span>
            </p>
          </div>
        )}

        {data?.data && (
          <p className="text-sm text-gray-600 mt-2">
            Total failures: <span className="font-semibold">{data.data.totalCount}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {data?.data.failures && data.data.failures.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Gym ID</TableHead>
                <TableHead>SMS Type</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Raw Error Trace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.failures.map((failure) => (
                <TableRow key={failure.id}>
                  <TableCell className="font-mono text-xs">
                    {formatTimestamp(failure.sent_at)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[80px]" title={failure.gym_id}>
                        {failure.gym_id.substring(0, 8)}...
                      </span>
                      <button
                        onClick={() => copyToClipboard(failure.gym_id, `gym-${failure.id}`)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {copiedId === `gym-${failure.id}` ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{getSMSTypeBadge(failure.sms_type)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {failure.phone_number}
                  </TableCell>
                  <TableCell>
                    {failure.error_message ? (
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-red-600">
                          {failure.error_message}
                        </summary>
                        <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
                          <pre className="text-xs text-red-800 whitespace-pre-wrap">
                            {failure.error_message}
                          </pre>
                          {failure.text_lk_message_id && (
                            <div className="mt-2 text-xs text-gray-600">
                              <span className="font-semibold">TextLK Message ID:</span>{' '}
                              <span className="font-mono">{failure.text_lk_message_id}</span>
                            </div>
                          )}
                        </div>
                      </details>
                    ) : (
                      <span className="text-sm text-gray-500 italic">No error message</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">No SMS failures found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 5: Compose Dashboard Page**

```typescript
// src/app/(admin)/system-health/page.tsx
import CronStatusGrid from './CronStatusGrid';
import RawSMSFailureTable from './RawSMSFailureTable';
import { Shield, Activity } from 'lucide-react';

export default function SystemHealthPage() {
  return (
    <div className="min-h-screen bg-gray-50">
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

          <section>
            <CronStatusGrid />
          </section>

          <section>
            <RawSMSFailureTable />
          </section>
        </div>
      </div>
    </div>
  );
}
```

**Step 6: Protect with Admin Layout**

```typescript
// src/app/(admin)/layout.tsx
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Basic protection: Check if admin secret is configured
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_API_SECRET;

  if (!adminSecret) {
    // If no admin secret is configured, block access entirely
    redirect('/dashboard');
  }

  return <div className="admin-layout">{children}</div>;
}
```

**Step 7: Update Environment Configuration**

```bash
# .env.example

# Admin Dashboard (generate with: openssl rand -base64 32)
# Used for SaaS admin-only routes and system health monitoring
ADMIN_API_SECRET=your-admin-api-secret
NEXT_PUBLIC_ADMIN_API_SECRET=your-admin-api-secret
```

#### Benefits of This Pattern

1. **Separation of Concerns**: User-facing UI shows sanitized errors; admin UI shows full technical details
2. **Security**: Technical infrastructure details hidden from end users via authorization layer
3. **Debugging**: Full error traces, stack traces, and database errors visible to administrators
4. **Monitoring**: Real-time view of system health (cron jobs, SMS failures, API errors)
5. **Historical Analysis**: Query patterns and failure trends for proactive maintenance
6. **Access Control**: Bearer token authentication ensures only authorized personnel see sensitive data
7. **Gym-Specific Drilldown**: Filter SMS failures by gym ID for targeted customer support debugging
   - **System-Wide View**: Identify provider-level issues affecting all gyms
   - **Gym-Specific View**: Troubleshoot SMS delivery problems for a specific customer
   - **Pattern Analysis**: Determine if failures are isolated or systemic
   - **Performance Optimized**: Composite index provides 10-100x speedup for filtered queries

#### When to Use This Pattern

- ✅ Multi-tenant SaaS platforms serving multiple organizations
- ✅ Systems where end users should not see technical infrastructure details
- ✅ Applications with scheduled background jobs requiring monitoring
- ✅ Services with external API dependencies (SMS, email, payment processors)
- ✅ Production systems requiring real-time operational visibility

#### When NOT to Use This Pattern

- ❌ Single-tenant applications where all users are administrators
- ❌ Internal tools used exclusively by developers
- ❌ Proof-of-concept or demo applications
- ❌ Systems without background jobs or external dependencies

#### Security Considerations

**Implemented (2026-07-06, commit `b890f8e`)**: the `ADMIN_API_SECRET` Bearer scheme was replaced with session-based checking against the `saas_admins` table (`src/lib/auth/requireSaasAdmin.ts`). Illustrative shape of what shipped:

```typescript
// Database-backed admin allow-list (shipped): Supabase session + saas_admins row
export async function GET(request: NextRequest) {
  const admin = await getSaasAdmin() // null unless a saas_admins row exists

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Proceed with admin operations
}
```

**Retired scheme (historical)**: the `ADMIN_API_SECRET` Bearer token above provided basic protection suitable for dev / internal-VPN / prototype use. It was replaced by the Supabase-session + `saas_admins` model for production and must not be reintroduced.

---
