const baseConfig = require('./jest.config')

module.exports = {
  ...baseConfig,
  testMatch: ['**/tests/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  testEnvironment: 'node',
}
