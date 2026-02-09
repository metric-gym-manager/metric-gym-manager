import { NextResponse } from 'next/server'
import { UnauthorizedError, ForbiddenError } from './auth'
import { ValidationError } from './validation'

export interface ErrorResponse {
  error: string
  message: string
  details?: any
  timestamp: string
}

/**
 * Global error handler for API routes
 */
export function handleError(error: unknown): NextResponse<ErrorResponse> {
  const timestamp = new Date().toISOString()

  // Unauthorized errors
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: error.message,
        timestamp,
      },
      { status: 401 }
    )
  }

  // Forbidden errors
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: error.message,
        timestamp,
      },
      { status: 403 }
    )
  }

  // Validation errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: 'Validation Error',
        message: error.message,
        details: error.errors.errors,
        timestamp,
      },
      { status: 400 }
    )
  }

  // Generic errors
  if (error instanceof Error) {
    // Don't expose internal errors in production
    const message =
      process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message,
        timestamp,
      },
      { status: 500 }
    )
  }

  // Unknown errors
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp,
    },
    { status: 500 }
  )
}
