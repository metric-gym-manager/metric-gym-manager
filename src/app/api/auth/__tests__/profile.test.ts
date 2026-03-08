/**
 * @jest-environment node
 */

/**
 * Tests for GET /api/auth/profile
 *
 * Ensures the profile endpoint does not leak sensitive fields
 * like user_id, created_at, or updated_at to the client.
 */

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockSafeProfile = {
  id: 'gym_123',
  username: 'fitlife_gym',
  email: 'owner@fitlife.com',
  email_verified: true,
  phone_number: '+94771234567',
  gym_name: 'FitLife Gym',
  gym_address: '123 Main St',
  gym_website: 'https://fitlife.com',
  profile_image_url: null,
};

jest.mock('@/lib/middleware/api-auth', () => ({
  getApiGymProfile: jest.fn(() =>
    Promise.resolve({
      gymProfile: mockSafeProfile,
      error: null,
    })
  ),
}));

import { GET } from '../../auth/profile/route';
import { getApiGymProfile } from '@/lib/middleware/api-auth';

// ============================================================================
// TESTS
// ============================================================================

describe('GET /api/auth/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns gym profile without sensitive fields', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockSafeProfile);

    // Ensure sensitive fields are NOT present
    expect(body.data).not.toHaveProperty('user_id');
    expect(body.data).not.toHaveProperty('created_at');
    expect(body.data).not.toHaveProperty('updated_at');
  });

  it('returns 401 when not authenticated', async () => {
    const mockError = new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );

    (getApiGymProfile as jest.Mock).mockResolvedValueOnce({
      gymProfile: null,
      error: mockError,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('sets Cache-Control to private, no-cache', async () => {
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
  });
});
