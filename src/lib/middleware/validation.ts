import { z, ZodSchema } from 'zod'
import { NextRequest } from 'next/server'

export class ValidationError extends Error {
  statusCode = 400
  errors: z.ZodError

  constructor(errors: z.ZodError) {
    super('Validation failed')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

/**
 * Validate request body against Zod schema
 */
export async function validateBody<T>(request: NextRequest, schema: ZodSchema<T>): Promise<T> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error)
    }
    throw error
  }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T>(request: NextRequest, schema: ZodSchema<T>): T {
  try {
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams)
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error)
    }
    throw error
  }
}

/**
 * Validate path parameters against Zod schema
 */
export function validateParams<T>(params: Record<string, string>, schema: ZodSchema<T>): T {
  try {
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error)
    }
    throw error
  }
}
