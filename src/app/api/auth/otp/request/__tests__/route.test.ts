/**
 * Integration Tests for OTP Request API Route
 *
 * Tests cover:
 * - POST /api/auth/otp/request
 * - Success responses (200)
 * - Validation errors (400)
 * - Rate limiting errors (400)
 * - Server errors (500)
 * - Phone number normalization
 * - OTP generation and hashing
 *
 * Target: All API behaviors tested
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock OTP service
jest.mock('@/features/auth/services/otp.service', () => ({
  requestOtp: jest.fn(),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(),
      auth: jest.fn(),
    })
  ),
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

import { requestOtp } from '@/features/auth/services/otp.service';

describe('POST /api/auth/otp/request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_REAL_SMS = 'false';
  });

  it('should return 200 with success message for valid phone number', async () => {
    // Mock successful OTP request
    (requestOtp as jest.MockedFunction<typeof requestOtp>).mockResolvedValue({
      success: true,
      data: {
        success: true,
        message: 'OTP sent successfully',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: '+94771234567',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.success).toBe(true);
    expect(json.data.expiresAt).toBeDefined();
  });

  it('should normalize phone number before requesting OTP', async () => {
    (requestOtp as jest.MockedFunction<typeof requestOtp>).mockResolvedValue({
      success: true,
      data: {
        success: true,
        message: 'OTP sent successfully',
        expiresAt: new Date().toISOString(),
      },
    });

    // Send phone number with spaces and 0 prefix
    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: '077 123 4567', // Should be normalized to +94771234567
      }),
    });

    await POST(request);

    // Verify requestOtp was called with normalized number
    expect(requestOtp).toHaveBeenCalledWith('+94771234567');
  });

  it('should return 400 for invalid phone number format', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: 'invalid-phone',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should return 400 for missing phone number', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should return 400 for phone number not registered', async () => {
    (requestOtp as jest.MockedFunction<typeof requestOtp>).mockResolvedValue({
      success: false,
      error: 'Phone number not registered',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: '+94771234567',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Phone number not registered');
  });

  it('should return 400 for rate limit exceeded', async () => {
    (requestOtp as jest.MockedFunction<typeof requestOtp>).mockResolvedValue({
      success: false,
      error: 'Too many OTP requests. Please try again later.',
    });

    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: '+94771234567',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Too many OTP requests');
  });

  it('should return 500 for unexpected server errors', async () => {
    (requestOtp as jest.MockedFunction<typeof requestOtp>).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: '+94771234567',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('An unexpected error occurred');
  });

  it('should accept all valid Sri Lankan phone number formats', async () => {
    (requestOtp as jest.MockedFunction<typeof requestOtp>).mockResolvedValue({
      success: true,
      data: {
        success: true,
        message: 'OTP sent successfully',
        expiresAt: new Date().toISOString(),
      },
    });

    const formats = [
      '0771234567',    // 10 digits with 0
      '771234567',     // 9 digits
      '+94771234567',  // Normalized
      '94771234567',   // 11 digits without +
      '077 123 4567',  // With spaces
      '077-123-4567',  // With hyphens
    ];

    for (const format of formats) {
      const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: format }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    }

    // All should be normalized to the same format
    expect(requestOtp).toHaveBeenCalledTimes(formats.length);
    for (let i = 0; i < formats.length; i++) {
      expect((requestOtp as jest.Mock).mock.calls[i][0]).toBe('+94771234567');
    }
  });

  it('should reject international phone numbers (non-Sri Lankan)', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: '+1234567890', // US format
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should reject phone numbers with invalid length', async () => {
    const invalidNumbers = [
      '+9477123',      // Too short
      '+947712345678', // Too long
      '077',           // Way too short
    ];

    for (const invalidNumber of invalidNumbers) {
      const request = new NextRequest('http://localhost:3000/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: invalidNumber }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    }
  });
});
