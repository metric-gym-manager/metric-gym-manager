# Cron Job Error Persistence Pattern (§2.6)

> On-demand reference. Not auto-injected.
> **Rule:** Every cron job persists execution results (start, finish, status, error) to a DB audit log.

---

### 2.6 Cron Job Error Persistence Pattern

**CRITICAL RULE**: All scheduled cron jobs MUST persist execution results to a database audit log for debugging, monitoring, and historical analysis.

#### ❌ WRONG: No Error Persistence

```typescript
// ❌ NEVER implement cron jobs without logging
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Execute job
    const result = await executeJob();

    // Only return result - errors lost if not monitored
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Job failed:', error); // Only console logging!
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Problems**:
- Errors only visible in platform logs (Vercel, etc.)
- No historical error tracking
- Cannot query failure rates or patterns
- Debugging requires searching through raw logs
- No execution duration metrics

#### ✅ CORRECT: Database-Persisted Execution Logging

**Step 1: Create Database Schema**

```sql
-- supabase/migrations/YYYYMMDD_create_cron_logs_table.sql
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failure')),
  summary JSONB,
  errors TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for query performance
CREATE INDEX idx_cron_logs_job_name ON cron_logs(job_name);
CREATE INDEX idx_cron_logs_started_at ON cron_logs(started_at DESC);
CREATE INDEX idx_cron_logs_status ON cron_logs(status);
CREATE INDEX idx_cron_logs_job_started ON cron_logs(job_name, started_at DESC);

-- RLS for service role access
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert cron logs"
  ON cron_logs FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can read all cron logs"
  ON cron_logs FOR SELECT TO service_role USING (true);
```

**Step 2: Create CronLogger Utility**

```typescript
// src/core/utils/cron/CronLogger.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type CronJobStatus = 'running' | 'success' | 'failure';

export class CronLogger {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Log the start of a cron job execution
   *
   * @param jobName - Name of the cron job (e.g., 'send-reminders')
   * @returns Log ID for subsequent updates
   */
  async logStart(jobName: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('cron_logs')
      .insert({
        job_name: jobName,
        started_at: new Date().toISOString(),
        status: 'running' as CronJobStatus,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to log cron start: ${error.message}`);
    return data.id;
  }

  /**
   * Log successful completion
   */
  async logSuccess(logId: string, summary: Record<string, unknown>): Promise<void> {
    await this.logComplete(logId, 'success', summary);
  }

  /**
   * Log failure with errors
   */
  async logFailure(logId: string, errors: string[], summary?: Record<string, unknown>): Promise<void> {
    await this.logComplete(logId, 'failure', summary || {}, errors);
  }

  /**
   * Update log record with completion data
   */
  private async logComplete(
    logId: string,
    status: 'success' | 'failure',
    summary: Record<string, unknown>,
    errors?: string[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('cron_logs')
      .update({
        completed_at: new Date().toISOString(),
        status,
        summary,
        errors: errors || null,
      })
      .eq('id', logId);

    if (error) throw new Error(`Failed to log cron completion: ${error.message}`);
  }
}
```

**Step 3: Export from Utils**

```typescript
// src/core/utils/cron/index.ts
export { CronLogger, type CronJobStatus, type CronLogRecord } from './CronLogger';
```

**Step 4: Implement in Cron Routes**

```typescript
// src/app/api/cron/send-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/core/utils/api/ApiResponse';
import { CronLogger } from '@/core/utils/cron';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const logger = new CronLogger(supabase);
  let logId: string | null = null;

  try {
    // 1. Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-key';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request');
      return NextResponse.json(
        ResponseBuilder.unauthorized(),
        { status: 401 }
      );
    }

    console.log('🚀 Starting send reminders cron job...');
    const startTime = Date.now();

    // 2. Log cron job start
    logId = await logger.logStart('send-reminders');

    // 3. Execute use case
    const container = await getAdminContainer();
    const sendReminders = container.getSendAutomatedRemindersUseCase();
    const summary = await sendReminders.execute();

    const duration = Date.now() - startTime;
    console.log(`⏱️  Cron job completed in ${duration}ms`);

    // 4. Log successful completion
    await logger.logSuccess(logId, {
      totalSent: summary.totalSent,
      byType: summary.byType,
      errors: summary.errors,
      duration: `${duration}ms`,
    });

    // 5. Return response
    return NextResponse.json(
      ResponseBuilder.success({
        totalSent: summary.totalSent,
        byType: summary.byType,
        errors: summary.errors,
        duration: `${duration}ms`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Send reminders cron error:', error);

    // 6. Log failure if we have a log ID
    if (logId) {
      await logger.logFailure(logId, [
        error instanceof Error ? error.message : 'Unknown error',
      ]);
    }

    // 7. Return error response
    return NextResponse.json(
      ResponseBuilder.internalError(
        'Failed to send reminders',
        error instanceof Error ? error.stack : undefined
      ),
      { status: 500 }
    );
  }
}

// Allow GET for manual testing (only in development)
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      ResponseBuilder.error('Method not allowed in production', 'METHOD_NOT_ALLOWED'),
      { status: 405 }
    );
  }

  console.log('🧪 Manual test: Starting send reminders cron job...');
  const container = await getAdminContainer();
  const sendReminders = container.getSendAutomatedRemindersUseCase();
  const summary = await sendReminders.execute();

  return NextResponse.json(ResponseBuilder.success(summary));
}
```

#### Benefits of This Pattern

1. **Complete Audit Trail**: Every cron execution logged with start time, completion time, status
2. **Historical Analysis**: Query patterns like "How many times did this job fail last month?"
3. **Performance Metrics**: Track execution duration trends over time
4. **Debugging**: Detailed error messages and summaries stored in structured format (JSONB)
5. **Monitoring**: Build dashboards showing cron job health across all jobs
6. **Alerting**: Query for recent failures and trigger notifications

#### Querying Cron Logs

```sql
-- Get all executions of a specific job
SELECT * FROM cron_logs
WHERE job_name = 'send-reminders'
ORDER BY started_at DESC
LIMIT 50;

-- Find recent failures
SELECT job_name, started_at, errors
FROM cron_logs
WHERE status = 'failure'
  AND started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

-- Calculate success rate by job
SELECT
  job_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successes,
  COUNT(*) FILTER (WHERE status = 'failure') as failures,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) as success_rate
FROM cron_logs
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY job_name
ORDER BY success_rate ASC;

-- Average execution duration
SELECT
  job_name,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM cron_logs
WHERE status = 'success'
  AND started_at > NOW() - INTERVAL '7 days'
GROUP BY job_name
ORDER BY avg_duration_seconds DESC;
```

#### When to Use This Pattern

- ✅ All scheduled cron jobs (daily, hourly, weekly, etc.)
- ✅ Background jobs processing large datasets
- ✅ Automated system maintenance tasks
- ✅ Any job where failure would be silent without logging

#### When NOT to Use This Pattern

- ❌ Real-time user-triggered actions (use standard error handling)
- ❌ High-frequency jobs (>1000/day) - consider sampling
- ❌ Jobs that run on every API request (too much overhead)

---


---
