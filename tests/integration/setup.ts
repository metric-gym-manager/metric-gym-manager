import { Pool } from 'pg'
import { beforeAll, afterAll } from '@jest/globals'

let pool: Pool

export async function setupTestDatabase() {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'gym_management_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  })

  // Run migrations or create test schema here
  // For now, assume migrations have been run manually
}

export async function teardownTestDatabase() {
  if (pool) {
    await pool.end()
  }
}

export function getTestPool() {
  return pool
}

// Setup and teardown for all tests
beforeAll(async () => {
  await setupTestDatabase()
})

afterAll(async () => {
  await teardownTestDatabase()
})
