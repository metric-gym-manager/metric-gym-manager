import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars'
process.env.JWT_EXPIRES_IN = '15m'
process.env.JWT_REFRESH_EXPIRES_IN = '7d'
process.env.ENABLE_MOCK_PAYMENTS = 'true'
