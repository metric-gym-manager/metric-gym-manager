import '@testing-library/jest-dom'

// Add custom matchers from jest-dom
// This will add methods like .toBeInTheDocument() to expect()

// Set up test environment variables.
// Fallbacks only: the integration suite (jest.integration.config.js) points
// these at a real disposable stack — clobbering them here would silently
// redirect every supabase-js call to a dead host.
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key-1234567890'
process.env.ENABLE_REAL_SMS = 'false'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
// The marketing-email key is full-access on the live Resend account: no unit
// test may reach it. Tests that need mailing configured pass a double.
delete process.env.RESEND_API_KEY
delete process.env.MARKETING_UNSUBSCRIBE_SECRET

// Mock Next.js server-side functions that require request context
// These are not available in Jest test environment
jest.mock('next/headers', () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      getAll: jest.fn(() => []),
      get: jest.fn(() => undefined),
      set: jest.fn(),
      delete: jest.fn(),
    })
  ),
  headers: jest.fn(() =>
    Promise.resolve({
      get: jest.fn(() => null),
      has: jest.fn(() => false),
    })
  ),
}))
