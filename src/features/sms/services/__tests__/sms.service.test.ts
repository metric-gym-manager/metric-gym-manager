/**
 * Unit Tests for SMS Service
 *
 * Comprehensive tests for SMS sending, message formatting, and logging
 * with focus on welcome SMS functionality for new member registration.
 */

// ============================================================================
// MOCK SETUP - Using Jest Factory Pattern (Properly Hoisted)
// ============================================================================

// Create a mock that will be populated by each test
let mockSupabaseClient: any;

// Mock @/lib/supabase/server with async function that returns current mock
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => mockSupabaseClient),
}));

// Mock text.lk SMS service
jest.mock('../textlk.service', () => ({
  sendSmsViaTextLk: jest.fn(() =>
    Promise.resolve({
      success: true,
      message_id: 'mock_msg_123',
      balance: 100,
    })
  ),
}));

// Import AFTER mocks are defined
import { sendSMS, formatReceiptSMS } from '../sms.service';
import { sendSmsViaTextLk } from '../textlk.service';

const mockSendSmsViaTextLk = sendSmsViaTextLk as jest.Mock;

// ============================================================================
// HELPER FUNCTIONS - Build Proper Mock Responses
// ============================================================================

function createMockSupabaseClient(config: {
  member?: { data: any; error: any };
  smsLogInsert?: { data: any; error: any };
}) {
  const fromMock = jest.fn((table: string) => {
    // Members table
    if (table === 'members') {
      const chainable: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      if (config.member) {
        chainable.single = jest.fn().mockResolvedValue(config.member);
      }

      return chainable;
    }

    // SMS logs table
    if (table === 'sms_logs') {
      const chainable: any = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      if (config.smsLogInsert) {
        chainable.single = jest.fn().mockResolvedValue(config.smsLogInsert);
      }

      return chainable;
    }

    return {};
  });

  return {
    from: fromMock,
  };
}

// ============================================================================
// TESTS - Welcome SMS Functionality
// ============================================================================

describe('SMS Service - Welcome SMS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_REAL_SMS = 'false'; // Use mock SMS by default
  });

  it('should format welcome message with member name, gym name, plan type and payment amount', async () => {
    const mockMember = {
      id: 'member_123',
      name: 'John Doe',
      phone_number: '+94771234567',
      plan_type: 'monthly',
      plan_amount: 5000.0,
      next_due_date: '2024-03-15',
      gyms: { gym_name: 'FitLife Gym' },
    };

    let capturedMessage: string | undefined;

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn((data: any) => {
              capturedMessage = data.message_body;
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { id: 'sms_log_123', ...data },
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    await sendSMS('gym_123', 'member_123', 'welcome', undefined, 5000.0);

    expect(capturedMessage).toBeDefined();
    expect(capturedMessage).toContain('Welcome to FitLife Gym');
    expect(capturedMessage).toContain('John Doe');
    expect(capturedMessage).toContain('Monthly membership');
    expect(capturedMessage).toContain('Rs.5000.00');
    expect(capturedMessage).toContain('Thank you for joining us!');
  });

  it('should use payment amount parameter instead of plan amount when provided', async () => {
    const mockMember = {
      id: 'member_123',
      name: 'Jane Smith',
      phone_number: '+94771234568',
      plan_type: 'monthly',
      plan_amount: 5000.0, // Regular amount
      next_due_date: '2024-03-15',
      gyms: { gym_name: 'PowerGym' },
    };

    let capturedMessage: string | undefined;

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn((data: any) => {
              capturedMessage = data.message_body;
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { id: 'sms_log_123', ...data },
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    // Payment amount is 4500 (discounted from 5000)
    await sendSMS('gym_123', 'member_123', 'welcome', undefined, 4500.0);

    expect(capturedMessage).toContain('Rs.4500.00'); // Should show discounted amount
    expect(capturedMessage).not.toContain('Rs.5000.00');
  });

  it('should capitalize plan type in welcome message', async () => {
    const mockMember = {
      id: 'member_123',
      name: 'Alex Brown',
      phone_number: '+94771234569',
      plan_type: 'annual',
      plan_amount: 50000.0,
      next_due_date: '2025-02-21',
      gyms: { gym_name: 'Elite Fitness' },
    };

    let capturedMessage: string | undefined;

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn((data: any) => {
              capturedMessage = data.message_body;
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { id: 'sms_log_123', ...data },
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    await sendSMS('gym_123', 'member_123', 'welcome', undefined, 50000.0);

    expect(capturedMessage).toContain('Annual membership');
    expect(capturedMessage).not.toContain('annual membership');
  });

  it('should log welcome SMS to database with correct metadata', async () => {
    const mockMember = {
      id: 'member_123',
      name: 'Sarah Johnson',
      phone_number: '+94771234570',
      plan_type: 'monthly',
      plan_amount: 6000.0,
      next_due_date: '2024-03-20',
      gyms: { gym_name: 'Health Hub' },
    };

    let capturedSmsLog: any;

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn((data: any) => {
              capturedSmsLog = data;
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { id: 'sms_log_123', ...data },
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    const result = await sendSMS('gym_123', 'member_123', 'welcome', undefined, 6000.0);

    expect(capturedSmsLog).toBeDefined();
    expect(capturedSmsLog.member_id).toBe('member_123');
    expect(capturedSmsLog.gym_id).toBe('gym_123');
    expect(capturedSmsLog.sms_type).toBe('welcome');
    expect(capturedSmsLog.phone_number).toBe('+94771234570');
    expect(capturedSmsLog.delivery_status).toBe('sent');
    expect(capturedSmsLog.sent_at).toBeDefined();
    expect(result.id).toBe('sms_log_123');
  });

  it('should throw error if member not found', async () => {
    mockSupabaseClient = createMockSupabaseClient({
      member: { data: null, error: null },
    });

    await expect(
      sendSMS('gym_123', 'nonexistent_member', 'welcome')
    ).rejects.toThrow('Member not found');
  });

  it('should handle database logging errors', async () => {
    const mockMember = {
      id: 'member_123',
      name: 'Test User',
      phone_number: '+94771234571',
      plan_type: 'monthly',
      plan_amount: 5000.0,
      next_due_date: '2024-03-15',
      gyms: { gym_name: 'Test Gym' },
    };

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'Database error' } }),
          };
        }
        return {};
      }),
    };

    await expect(
      sendSMS('gym_123', 'member_123', 'welcome')
    ).rejects.toThrow('Failed to log SMS');
  });
});

// ============================================================================
// TESTS - Real SMS Integration (text.lk)
// ============================================================================

describe('SMS Service - Real SMS Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send real SMS via text.lk when feature flag is enabled', async () => {
    process.env.ENABLE_REAL_SMS = 'true';

    const mockMember = {
      id: 'member_123',
      name: 'John Doe',
      phone_number: '+94771234567',
      plan_type: 'monthly',
      plan_amount: 5000.0,
      next_due_date: '2024-03-15',
      gyms: { gym_name: 'FitLife Gym' },
    };

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'sms_log_123', text_lk_message_id: 'mock_msg_123' },
              error: null,
            }),
          };
        }
        return {};
      }),
    };

    await sendSMS('gym_123', 'member_123', 'welcome', undefined, 5000.0);

    expect(mockSendSmsViaTextLk).toHaveBeenCalledWith({
      to: '+94771234567',
      message: expect.stringContaining('Welcome to FitLife Gym'),
    });
  });

  it('should save text.lk message ID when SMS sent successfully', async () => {
    process.env.ENABLE_REAL_SMS = 'true';
    mockSendSmsViaTextLk.mockResolvedValue({
      success: true,
      message_id: 'textlk_msg_456',
      balance: 95,
    });

    const mockMember = {
      id: 'member_123',
      name: 'John Doe',
      phone_number: '+94771234567',
      plan_type: 'monthly',
      plan_amount: 5000.0,
      next_due_date: '2024-03-15',
      gyms: { gym_name: 'FitLife Gym' },
    };

    let capturedSmsLog: any;

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn((data: any) => {
              capturedSmsLog = data;
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { id: 'sms_log_123', ...data },
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    await sendSMS('gym_123', 'member_123', 'welcome', undefined, 5000.0);

    expect(capturedSmsLog.text_lk_message_id).toBe('textlk_msg_456');
    expect(capturedSmsLog.delivery_status).toBe('sent');
  });

  it('should mark SMS as failed when text.lk returns error', async () => {
    process.env.ENABLE_REAL_SMS = 'true';
    mockSendSmsViaTextLk.mockResolvedValue({
      success: false,
      error: 'Insufficient credits',
    });

    const mockMember = {
      id: 'member_123',
      name: 'John Doe',
      phone_number: '+94771234567',
      plan_type: 'monthly',
      plan_amount: 5000.0,
      next_due_date: '2024-03-15',
      gyms: { gym_name: 'FitLife Gym' },
    };

    let capturedSmsLog: any;

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn((data: any) => {
              capturedSmsLog = data;
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { id: 'sms_log_123', ...data },
                  error: null,
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    await sendSMS('gym_123', 'member_123', 'welcome', undefined, 5000.0);

    expect(capturedSmsLog.delivery_status).toBe('failed');
    expect(capturedSmsLog.text_lk_message_id).toBeNull();
  });

  it('should not call text.lk when feature flag is disabled', async () => {
    process.env.ENABLE_REAL_SMS = 'false';

    const mockMember = {
      id: 'member_123',
      name: 'John Doe',
      phone_number: '+94771234567',
      plan_type: 'monthly',
      plan_amount: 5000.0,
      next_due_date: '2024-03-15',
      gyms: { gym_name: 'FitLife Gym' },
    };

    mockSupabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMember, error: null }),
          };
        }
        if (table === 'sms_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'sms_log_123' },
              error: null,
            }),
          };
        }
        return {};
      }),
    };

    await sendSMS('gym_123', 'member_123', 'welcome', undefined, 5000.0);

    expect(mockSendSmsViaTextLk).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS - formatReceiptSMS
// ============================================================================

describe('SMS Service - formatReceiptSMS', () => {
  it('should format receipt message with payment details', () => {
    const message = formatReceiptSMS(
      'John Doe',
      'FitLife Gym',
      5000.0,
      '2024-04-21',
      null,
      null
    );

    expect(message).toContain('Dear John Doe');
    expect(message).toContain('Rs.5000.00 received');
    expect(message).toContain('21/04/2024');
    expect(message).toContain('FitLife Gym');
    expect(message).not.toContain('Discount');
  });

  it('should include discount details when provided', () => {
    const message = formatReceiptSMS(
      'Jane Smith',
      'PowerGym',
      4500.0,
      '2024-04-21',
      'Early Bird',
      10
    );

    expect(message).toContain('Rs.4500.00 received');
    expect(message).toContain('Discount: Early Bird 10% applied');
    expect(message).toContain('21/04/2024');
  });

  it('should format date in GB locale (DD/MM/YYYY)', () => {
    const message = formatReceiptSMS(
      'Test User',
      'Test Gym',
      3000.0,
      '2024-12-25',
      null,
      null
    );

    expect(message).toContain('25/12/2024');
  });
});
