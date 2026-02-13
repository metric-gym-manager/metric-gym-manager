/**
 * Unit Tests for OTP Service
 *
 * Comprehensive tests for OTP generation, hashing, verification, rate limiting,
 * and session creation using proper Jest mock factory pattern.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcrypt';

// ============================================================================
// MOCK SETUP - Using Jest Factory Pattern (Properly Hoisted)
// ============================================================================

// Create a mock that will be populated by each test
let mockSupabaseClient: any;

// Mock @/lib/supabase/server
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock text.lk SMS service
jest.mock('@/features/sms/services/textlk.service', () => ({
  sendSmsViaTextLk: jest.fn(() =>
    Promise.resolve({
      success: true,
      message_id: 'mock_msg_123',
    })
  ),
}));

// Import AFTER mocks are defined
import {
  requestOtp,
  verifyOtpAndLogin,
  updatePhoneNumber,
  cleanupExpiredOtpTokens,
} from '../otp.service';

// ============================================================================
// HELPER FUNCTIONS - Build Proper Mock Responses
// ============================================================================

function createMockSupabaseClient(config: {
  otpTokens?: { data: any[]; error: any };
  gymProfile?: { data: any; error: any };
  otpInsert?: { error: any };
  otpUpdate?: { error: any };
  gymUpdate?: { data: any; error: any };
  authUser?: { data: any; error: any };
  authLink?: { data: any; error: any };
  authSession?: { error: any };
}) {
  const fromMock = jest.fn((table: string) => {
    // OTP tokens table
    if (table === 'otp_tokens') {
      const chainable: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
      };

      // For queries (select)
      if (config.otpTokens) {
        chainable.order = jest.fn().mockResolvedValue(config.otpTokens);
        chainable.gte = jest.fn().mockResolvedValue(config.otpTokens);
      }

      // For inserts
      if (config.otpInsert) {
        chainable.insert = jest.fn().mockResolvedValue(config.otpInsert);
      }

      // For updates
      if (config.otpUpdate) {
        chainable.update = jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(config.otpUpdate),
        });
      }

      // For deletes
      chainable.delete = jest.fn().mockReturnValue({
        lt: jest.fn().mockResolvedValue({ error: null }),
      });

      return chainable;
    }

    // Gyms table
    if (table === 'gyms') {
      const chainable: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      // For queries
      if (config.gymProfile) {
        chainable.single = jest.fn().mockResolvedValue(config.gymProfile);
      }

      // For updates
      if (config.gymUpdate) {
        chainable.update = jest.fn().mockReturnThis();
        chainable.select = jest.fn().mockReturnThis();
        chainable.single = jest.fn().mockResolvedValue(config.gymUpdate);
      }

      return chainable;
    }

    return {};
  });

  return {
    from: fromMock,
    auth: {
      admin: {
        getUserById: jest.fn().mockResolvedValue(
          config.authUser || { data: null, error: null }
        ),
        generateLink: jest.fn().mockResolvedValue(
          config.authLink || { data: null, error: null }
        ),
      },
      setSession: jest.fn().mockResolvedValue(
        config.authSession || { error: null }
      ),
    },
  };
}

// ============================================================================
// TESTS - Comprehensive Coverage
// ============================================================================

describe('OTP Service - requestOtp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_REAL_SMS = 'false';
  });

  it('should generate OTP and hash it with bcrypt', async () => {
    let capturedOtp: string | undefined;

    mockSupabaseClient = createMockSupabaseClient({
      otpTokens: { data: [], error: null }, // No recent attempts (rate limit check)
      gymProfile: {
        data: { id: 'gym_123', user_id: 'user_123' },
        error: null,
      },
      otpInsert: { error: null },
    });

    // Capture the OTP code when inserted
    mockSupabaseClient.from = jest.fn((table: string) => {
      if (table === 'otp_tokens') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          insert: jest.fn((data: any) => {
            capturedOtp = data.otp_code;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'gyms') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({
              data: { id: 'gym_123', user_id: 'user_123' },
              error: null,
            }),
        };
      }
      return {};
    });

    const result = await requestOtp('+94771234567');

    // Assertions
    expect(result.success).toBe(true);
    expect(capturedOtp).toBeDefined();
    expect(capturedOtp!.length).toBe(60); // bcrypt hash length
    expect(capturedOtp).toMatch(/^\$2[ab]\$/); // bcrypt format
  });

  it('should enforce 10-minute OTP expiry', async () => {
    let capturedExpiresAt: string | undefined;

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'otp_tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockResolvedValue({ data: [], error: null }),
            insert: jest.fn((data: any) => {
              capturedExpiresAt = data.expires_at;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'gyms') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest
              .fn()
              .mockResolvedValue({
                data: { id: 'gym_123', user_id: 'user_123' },
                error: null,
              }),
          };
        }
        return {};
      }),
    };

    await requestOtp('+94771234567');

    expect(capturedExpiresAt).toBeDefined();
    const now = new Date();
    const expiry = new Date(capturedExpiresAt!);
    const diffMinutes = (expiry.getTime() - now.getTime()) / (1000 * 60);

    expect(diffMinutes).toBeGreaterThanOrEqual(9.98); // ~10 minutes
    expect(diffMinutes).toBeLessThanOrEqual(10.02);
  });

  it('should enforce rate limiting (3 requests per hour)', async () => {
    mockSupabaseClient = createMockSupabaseClient({
      otpTokens: {
        data: [{ id: '1' }, { id: '2' }, { id: '3' }], // 3 recent attempts
        error: null,
      },
    });

    const result = await requestOtp('+94771234567');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Too many OTP requests');
  });

  it('should reject unregistered phone number', async () => {
    mockSupabaseClient = createMockSupabaseClient({
      otpTokens: { data: [], error: null },
      gymProfile: { data: null, error: null }, // Phone not found
    });

    const result = await requestOtp('+94771234567');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Phone number not registered');
  });

  it('should handle database errors gracefully', async () => {
    mockSupabaseClient = createMockSupabaseClient({
      otpTokens: {
        data: [],
        error: { message: 'Database connection failed' },
      },
    });

    const result = await requestOtp('+94771234567');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to verify rate limit');
  });
});

describe('OTP Service - verifyOtpAndLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should verify OTP with bcrypt and create session', async () => {
    const plainOtp = '123456';
    const hashedOtp = await bcrypt.hash(plainOtp, 10);

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'otp_tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'otp_123',
                  otp_code: hashedOtp,
                  phone_number: '+94771234567',
                  used: false,
                  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                },
              ],
              error: null,
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'gyms') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'gym_123',
                user_id: 'user_123',
                gym_name: 'Test Gym',
                phone_number: '+94771234567',
              },
              error: null,
            }),
          };
        }
        return {};
      }),
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: { user: { id: 'user_123', email: 'test@example.com' } },
            error: null,
          }),
          generateLink: jest.fn().mockResolvedValue({
            data: {
              properties: {
                access_token: 'mock_access_token',
                refresh_token: 'mock_refresh_token',
              },
            },
            error: null,
          }),
        },
        setSession: jest.fn().mockResolvedValue({ error: null }),
      },
    };

    const result = await verifyOtpAndLogin('+94771234567', plainOtp);

    expect(result.success).toBe(true);
    expect(result.data?.user).toBeDefined();
    expect(result.data?.user.id).toBe('user_123');
    expect(result.data?.gymProfile).toBeDefined();
    expect(result.data?.gymProfile.gym_name).toBe('Test Gym');

    // Verify session was created
    expect(mockSupabaseClient.auth.admin.generateLink).toHaveBeenCalled();
    expect(mockSupabaseClient.auth.setSession).toHaveBeenCalledWith({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
    });
  });

  it('should reject invalid OTP code (bcrypt mismatch)', async () => {
    const correctOtp = '123456';
    const wrongOtp = '654321';
    const hashedOtp = await bcrypt.hash(correctOtp, 10);

    mockSupabaseClient = createMockSupabaseClient({
      otpTokens: {
        data: [
          {
            id: 'otp_123',
            otp_code: hashedOtp,
            phone_number: '+94771234567',
            used: false,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
        ],
        error: null,
      },
    });

    const result = await verifyOtpAndLogin('+94771234567', wrongOtp);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid or expired OTP');
  });

  it('should reject expired OTP', async () => {
    mockSupabaseClient = createMockSupabaseClient({
      otpTokens: { data: [], error: null }, // No valid tokens
    });

    const result = await verifyOtpAndLogin('+94771234567', '123456');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid or expired OTP');
  });

  it('should reject already used OTP', async () => {
    const plainOtp = '123456';
    const hashedOtp = await bcrypt.hash(plainOtp, 10);

    mockSupabaseClient = createMockSupabaseClient({
      otpTokens: { data: [], error: null }, // No unused tokens
    });

    const result = await verifyOtpAndLogin('+94771234567', plainOtp);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid or expired OTP');
  });

  it('should handle session creation failure', async () => {
    const plainOtp = '123456';
    const hashedOtp = await bcrypt.hash(plainOtp, 10);

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'otp_tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'otp_123',
                  otp_code: hashedOtp,
                  phone_number: '+94771234567',
                  used: false,
                  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                },
              ],
              error: null,
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'gyms') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'gym_123',
                user_id: 'user_123',
                gym_name: 'Test Gym',
                phone_number: '+94771234567',
              },
              error: null,
            }),
          };
        }
        return {};
      }),
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: { user: { id: 'user_123', email: 'test@example.com' } },
            error: null,
          }),
          generateLink: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Failed to generate link' },
          }),
        },
        setSession: jest.fn(),
      },
    };

    const result = await verifyOtpAndLogin('+94771234567', plainOtp);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to create session');
  });
});

describe('OTP Service - updatePhoneNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update phone number after OTP verification', async () => {
    const plainOtp = '123456';
    const hashedOtp = await bcrypt.hash(plainOtp, 10);

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'otp_tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'otp_123',
                  otp_code: hashedOtp,
                  phone_number: '+94771234567',
                  used: false,
                  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                },
              ],
              error: null,
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'gyms') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }), // No conflict
            update: jest.fn().mockReturnThis(),
          };
        }
        return {};
      }),
    };

    const result = await updatePhoneNumber('user_123', '+94771234567', plainOtp);

    expect(result.success).toBe(true);
    expect(result.data?.phone_number).toBe('+94771234567');
  });

  it('should reject if phone number already in use', async () => {
    const plainOtp = '123456';
    const hashedOtp = await bcrypt.hash(plainOtp, 10);

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'otp_tokens') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'otp_123',
                  otp_code: hashedOtp,
                  phone_number: '+94771234567',
                  used: false,
                  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                },
              ],
              error: null,
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'gyms') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'other_gym_456' }, // Phone already exists
              error: null,
            }),
          };
        }
        return {};
      }),
    };

    const result = await updatePhoneNumber('user_123', '+94771234567', plainOtp);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Phone number already in use');
  });
});

describe('OTP Service - cleanupExpiredOtpTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete OTP tokens older than 1 hour', async () => {
    const deleteFn = jest.fn().mockReturnThis();
    const ltFn = jest.fn().mockResolvedValue({ error: null });

    mockSupabaseClient = {
      from: jest.fn(() => ({
        delete: deleteFn.mockReturnValue({ lt: ltFn }),
      })),
    };

    await cleanupExpiredOtpTokens();

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('otp_tokens');
    expect(deleteFn).toHaveBeenCalled();
    expect(ltFn).toHaveBeenCalled();
  });

  it('should handle cleanup errors gracefully', async () => {
    mockSupabaseClient = {
      from: jest.fn(() => ({
        delete: jest.fn().mockReturnValue({
          lt: jest.fn().mockResolvedValue({
            error: { message: 'Delete failed' },
          }),
        }),
      })),
    };

    // Should not throw
    await expect(cleanupExpiredOtpTokens()).resolves.not.toThrow();
  });
});
