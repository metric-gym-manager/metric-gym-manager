/**
 * Cron Logger Utility
 *
 * Provides persistence layer for cron job execution tracking.
 * Logs cron job start, completion, status, summaries, and errors to the database.
 *
 * @example
 * // In a cron job route
 * const logger = new CronLogger(supabase);
 * const logId = await logger.logStart('send-reminders');
 *
 * try {
 *   const summary = await executeJob();
 *   await logger.logComplete(logId, 'success', summary);
 * } catch (error) {
 *   await logger.logComplete(logId, 'failure', {}, [error.message]);
 * }
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Status of a cron job execution
 */
export type CronJobStatus = 'running' | 'success' | 'failure';

/**
 * Cron job log record
 */
export interface CronLogRecord {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: CronJobStatus;
  summary: Record<string, unknown> | null;
  errors: string[] | null;
  created_at: string;
}

/**
 * CronLogger - Utility for persisting cron job execution logs
 *
 * Provides methods to log cron job start and completion to the database.
 * Enables debugging and monitoring of scheduled jobs.
 */
export class CronLogger {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Log the start of a cron job execution
   *
   * Inserts a new record with status='running' and returns the log ID.
   *
   * @param jobName - Name of the cron job (e.g., 'send-reminders')
   * @returns Log ID for subsequent updates
   *
   * @example
   * const logId = await logger.logStart('send-reminders');
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

    if (error) {
      console.error(`Failed to log cron start for ${jobName}:`, error);
      throw new Error(`Failed to log cron start: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create cron log record');
    }

    return data.id;
  }

  /**
   * Log the completion of a cron job execution
   *
   * Updates the existing log record with completion time, status, summary, and errors.
   *
   * @param logId - ID of the log record created by logStart
   * @param status - Final status ('success' or 'failure')
   * @param summary - JSON summary of job execution
   * @param errors - Optional array of error messages
   *
   * @example
   * await logger.logComplete(logId, 'success', {
   *   totalSent: 10,
   *   totalFailed: 2,
   * });
   *
   * @example
   * await logger.logComplete(logId, 'failure', {}, [
   *   'Failed to connect to database',
   *   'Transaction rolled back',
   * ]);
   */
  async logComplete(
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

    if (error) {
      console.error(`Failed to log cron completion for ${logId}:`, error);
      throw new Error(`Failed to log cron completion: ${error.message}`);
    }
  }

  /**
   * Log a failed cron job execution
   *
   * Convenience method for logging failures with errors.
   *
   * @param logId - ID of the log record created by logStart
   * @param errors - Array of error messages
   * @param summary - Optional partial summary data
   *
   * @example
   * await logger.logFailure(logId, [
   *   'SMS provider returned 500',
   *   'Failed to update 3 members',
   * ], { totalAttempted: 10 });
   */
  async logFailure(
    logId: string,
    errors: string[],
    summary?: Record<string, unknown>
  ): Promise<void> {
    await this.logComplete(logId, 'failure', summary || {}, errors);
  }

  /**
   * Log a successful cron job execution
   *
   * Convenience method for logging success.
   *
   * @param logId - ID of the log record created by logStart
   * @param summary - Summary of job execution
   *
   * @example
   * await logger.logSuccess(logId, {
   *   totalUpdated: 5,
   *   totalExpired: 3,
   *   duration: '1200ms',
   * });
   */
  async logSuccess(
    logId: string,
    summary: Record<string, unknown>
  ): Promise<void> {
    await this.logComplete(logId, 'success', summary);
  }
}
