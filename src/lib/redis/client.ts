import Redis, { Redis as RedisClient } from 'ioredis'

let redisClient: RedisClient | null = null

export interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
}

/**
 * Initialize Redis client
 */
export function initializeRedis(config?: RedisConfig): RedisClient {
  if (!redisClient) {
    redisClient = new Redis(
      config || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: 0,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000)
          return delay
        },
      }
    )
  }
  return redisClient
}

/**
 * Get Redis client instance
 */
export function getRedis(): RedisClient {
  if (!redisClient) {
    return initializeRedis()
  }
  return redisClient
}

/**
 * Cache helper with TTL
 */
export async function setCache(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
  const redis = getRedis()
  await redis.setex(key, ttlSeconds, JSON.stringify(value))
}

/**
 * Get cached value
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const redis = getRedis()
  const value = await redis.get(key)
  return value ? JSON.parse(value) : null
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  const redis = getRedis()
  await redis.del(key)
}

/**
 * Delete cache by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  const redis = getRedis()
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
