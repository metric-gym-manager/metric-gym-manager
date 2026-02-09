import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

let pool: Pool | null = null

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

/**
 * Initialize database connection pool
 */
export function initializePool(config?: DatabaseConfig): Pool {
  if (!pool) {
    pool = new Pool(
      config || {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'gym_management_dev',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    )
  }
  return pool
}

/**
 * Get database pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool()
  }
  return pool
}

/**
 * Execute a query with automatic connection handling
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool()
  return pool.query<T>(text, params)
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Set current user context for RLS
 */
export async function setUserContext(
  client: PoolClient | Pool,
  userId: string
): Promise<void> {
  await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId])
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
