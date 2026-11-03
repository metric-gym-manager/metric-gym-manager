/**
 * @jest-environment node
 */

/**
 * Cron Route Handler Tests
 *
 * Vercel Cron invokes cron paths with HTTP GET requests. Every cron route
 * must therefore execute its job on GET (with CRON_SECRET bearer auth) as
 * well as POST. These tests guard against regressing to POST-only handling,
 * which silently disabled all scheduled jobs in production (GET returned 405).
 */

import { NextRequest } from 'next/server';

const mockExecuteReminders = jest.fn();
const mockExecuteUpdateExpired = jest.fn();
const mockExecuteCancelOverdue = jest.fn();
const mockExecuteExpireSuspended = jest.fn();
const mockLogSuccess = jest.fn().mockResolvedValue(undefined);

jest.mock('@/features/sms', () => ({
  createSendAutomatedReminders: jest.fn(() => ({ execute: mockExecuteReminders })),
}));

jest.mock('@/features/members', () => ({
  createUpdateExpiredStatus: jest.fn(() => ({ execute: mockExecuteUpdateExpired })),
  createCancelOverdueMembers: jest.fn(() => ({ execute: mockExecuteCancelOverdue })),
  createExpireSuspendedMembers: jest.fn(() => ({ execute: mockExecuteExpireSuspended })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({})),
}));

jest.mock('@/lib/cron', () => ({
  CronLogger: jest.fn().mockImplementation(() => ({
    logStart: jest.fn().mockResolvedValue('cron-log-id'),
    logSuccess: mockLogSuccess,
    logFailure: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Import AFTER mocks are defined
import * as sendRemindersRoute from '../send-reminders/route';
import * as updateExpiredRoute from '../update-expired-status/route';
import * as cancelOverdueRoute from '../cancel-overdue-members/route';
import * as expireSuspendedRoute from '../expire-suspended-members/route';

const CRON_SECRET = 'test-cron-secret';

function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (authHeader ?? null) : null,
    },
  } as unknown as NextRequest;
}

function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('Cron routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;

    mockExecuteReminders.mockResolvedValue({
      totalSent: 2,
      byType: {},
      errors: [],
      membersProcessed: 5,
      membersSkipped: 3,
    });
    mockExecuteUpdateExpired.mockResolvedValue({
      totalUpdated: 1,
      updatedMembers: [],
      errors: [],
      skippedChanged: 0,
    });
    mockExecuteCancelOverdue.mockResolvedValue({
      totalCancelled: 0,
      cancelledMembers: [],
      errors: [],
      skippedChanged: 0,
    });
    mockExecuteExpireSuspended.mockResolvedValue({
      totalExpired: 0,
      expiredMembers: [],
      errors: [],
      skippedChanged: 0,
    });
  });

  afterEach(() => {
    setNodeEnv('test');
    delete process.env.CRON_SECRET;
  });

  describe('GET in production (Vercel Cron invocation)', () => {
    beforeEach(() => setNodeEnv('production'));

    const cases: Array<[string, (req: NextRequest) => Promise<Response>, jest.Mock]> = [
      ['send-reminders', sendRemindersRoute.GET, mockExecuteReminders],
      ['update-expired-status', updateExpiredRoute.GET, mockExecuteUpdateExpired],
      ['cancel-overdue-members', cancelOverdueRoute.GET, mockExecuteCancelOverdue],
      ['expire-suspended-members', expireSuspendedRoute.GET, mockExecuteExpireSuspended],
    ];

    it.each(cases)(
      '%s executes the job when the CRON_SECRET bearer token is valid',
      async (_name, handler, executeMock) => {
        const response = await handler(makeRequest(`Bearer ${CRON_SECRET}`));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(executeMock).toHaveBeenCalledTimes(1);
      }
    );

    it.each(cases)(
      '%s rejects requests without an authorization header',
      async (_name, handler, executeMock) => {
        const response = await handler(makeRequest());

        expect(response.status).toBe(401);
        expect(executeMock).not.toHaveBeenCalled();
      }
    );

    it.each(cases)(
      '%s rejects requests with a wrong secret',
      async (_name, handler, executeMock) => {
        const response = await handler(makeRequest('Bearer wrong-secret'));

        expect(response.status).toBe(401);
        expect(executeMock).not.toHaveBeenCalled();
      }
    );
  });

  describe('POST (manual/external trigger)', () => {
    beforeEach(() => setNodeEnv('production'));

    it('send-reminders executes the job with a valid bearer token', async () => {
      const response = await sendRemindersRoute.POST(
        makeRequest(`Bearer ${CRON_SECRET}`)
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockExecuteReminders).toHaveBeenCalledTimes(1);
    });

    it('send-reminders rejects an invalid bearer token', async () => {
      const response = await sendRemindersRoute.POST(makeRequest('Bearer nope'));

      expect(response.status).toBe(401);
      expect(mockExecuteReminders).not.toHaveBeenCalled();
    });
  });

  describe('GET in development (manual testing convenience)', () => {
    beforeEach(() => setNodeEnv('development'));

    it('send-reminders executes without authentication', async () => {
      const response = await sendRemindersRoute.GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockExecuteReminders).toHaveBeenCalledTimes(1);
    });
  });
});

describe('status crons report members skipped because they changed mid-run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  const cases: Array<[string, (req: NextRequest) => Promise<Response>, jest.Mock, Record<string, unknown>]> = [
    ['update-expired-status', updateExpiredRoute.POST, mockExecuteUpdateExpired, { totalUpdated: 0, updatedMembers: [] }],
    ['cancel-overdue-members', cancelOverdueRoute.POST, mockExecuteCancelOverdue, { totalCancelled: 0, cancelledMembers: [] }],
    ['expire-suspended-members', expireSuspendedRoute.POST, mockExecuteExpireSuspended, { totalExpired: 0, expiredMembers: [] }],
  ];

  // POST: outside production a bare GET skips the logger (a dev shortcut), and
  // the audit log is the thing under test.
  it.each(cases)('%s returns and logs skippedChanged', async (_name, handler, executeMock, base) => {
    executeMock.mockResolvedValue({ ...base, errors: [], skippedChanged: 2 });

    const response = await handler(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await response.json();

    expect(body.data.skippedChanged).toBe(2);

    // The audit log (rule 2.6) is where an operator would look for a skip.
    expect(mockLogSuccess).toHaveBeenCalledWith(
      'cron-log-id',
      expect.objectContaining({ skippedChanged: 2 })
    );
  });
});
