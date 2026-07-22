/**
 * Standardized API Response Format
 *
 * This provides a consistent response structure across all API endpoints.
 * All API routes should use these response builders.
 */

/**
 * Metadata for paginated responses
 */
export interface ResponseMeta {
  /**
   * Current page number (1-indexed)
   */
  page?: number;

  /**
   * Total number of pages
   */
  totalPages?: number;

  /**
   * Total count of items
   */
  totalCount?: number;

  /**
   * Number of items per page
   */
  limit?: number;

  /**
   * Response timestamp
   */
  timestamp?: string;

  /**
   * Additional metadata
   */
  [key: string]: unknown;
}

/**
 * Success response interface
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/**
 * Error response interface
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
    stack?: string; // Only in development
  };
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Response builder utility class
 *
 * Provides static methods to construct standardized API responses.
 *
 * @example
 * // Success response
 * return NextResponse.json(ResponseBuilder.success({ id: '123', name: 'John' }));
 *
 * @example
 * // Success with pagination
 * return NextResponse.json(
 *   ResponseBuilder.success(members, { page: 1, totalPages: 5, totalCount: 100 })
 * );
 *
 * @example
 * // Error response
 * return NextResponse.json(
 *   ResponseBuilder.error('Member not found', 'NOT_FOUND'),
 *   { status: 404 }
 * );
 */
export class ResponseBuilder {
  /**
   * Create a success response
   *
   * @param data - Response data
   * @param meta - Optional metadata (pagination, etc.)
   * @returns Success response object
   */
  static success<T>(data: T, meta?: ResponseMeta): ApiSuccessResponse<T> {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
    };

    if (meta) {
      response.meta = {
        ...meta,
        timestamp: meta.timestamp || new Date().toISOString(),
      };
    }

    return response;
  }

  /**
   * Create a raw binary response (images, PDFs, other non-JSON assets).
   *
   * Binary payloads cannot use the JSON success envelope, so asset routes build
   * their response through this helper — keeping response construction
   * centralized in `ResponseBuilder`. Error paths on these routes still use the
   * JSON error builders below (with machine-readable codes).
   *
   * @param body - The binary payload
   * @param contentType - MIME type (e.g. 'image/png')
   * @param options - Optional Cache-Control, download filename, and status
   * @returns A `Response` streaming the bytes with the given content type
   *
   * @example
   * return ResponseBuilder.binary(png, 'image/png', { cacheControl: 'private, no-store' });
   */
  static binary(
    body: ArrayBuffer | ArrayBufferView,
    contentType: string,
    options?: { cacheControl?: string; filename?: string; status?: number }
  ): Response {
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (options?.cacheControl) {
      headers['Cache-Control'] = options.cacheControl;
    }
    if (options?.filename) {
      headers['Content-Disposition'] = `inline; filename="${options.filename}"`;
    }
    return new Response(body as BodyInit, {
      status: options?.status ?? HTTP_STATUS.OK,
      headers,
    });
  }

  /**
   * Create an error response
   *
   * @param message - Error message
   * @param code - Error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
   * @param details - Additional error details
   * @param stack - Error stack trace (only in development)
   * @returns Error response object
   */
  static error(
    message: string,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>,
    stack?: string
  ): ApiErrorResponse {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message,
        code,
      },
    };

    if (details) {
      response.error.details = details;
    }

    // Only include stack trace in development
    if (stack && process.env.NODE_ENV === 'development') {
      response.error.stack = stack;
    }

    return response;
  }

  /**
   * Create a validation error response
   *
   * @param errors - Validation errors by field
   * @returns Error response object
   *
   * @example
   * ResponseBuilder.validationError({
   *   email: ['Invalid email format'],
   *   name: ['Name is required', 'Name must be at least 2 characters']
   * })
   */
  static validationError(errors: Record<string, string[]>): ApiErrorResponse {
    return this.error('Validation failed', 'VALIDATION_ERROR', { errors });
  }

  /**
   * Create a not found error response
   *
   * @param resource - Resource name (e.g., 'Member', 'Payment')
   * @returns Error response object
   */
  static notFound(resource: string): ApiErrorResponse {
    return this.error(`${resource} not found`, 'NOT_FOUND');
  }

  /**
   * Create an unauthorized error response
   *
   * @param message - Optional custom message
   * @returns Error response object
   */
  static unauthorized(message: string = 'Unauthorized'): ApiErrorResponse {
    return this.error(message, 'UNAUTHORIZED');
  }

  /**
   * Create a forbidden error response
   *
   * @param message - Optional custom message
   * @returns Error response object
   */
  static forbidden(message: string = 'Forbidden'): ApiErrorResponse {
    return this.error(message, 'FORBIDDEN');
  }

  /**
   * Create a bad request error response
   *
   * @param message - Error message
   * @param details - Additional details
   * @returns Error response object
   */
  static badRequest(message: string, details?: Record<string, unknown>): ApiErrorResponse {
    return this.error(message, 'BAD_REQUEST', details);
  }

  /**
   * Create a conflict error response
   *
   * @param message - Error message
   * @param details - Additional details
   * @returns Error response object
   */
  static conflict(message: string, details?: Record<string, unknown>): ApiErrorResponse {
    return this.error(message, 'CONFLICT', details);
  }

  /**
   * Create an internal server error response
   *
   * @param message - Error message
   * @param stack - Error stack trace
   * @returns Error response object
   */
  static internalError(message: string = 'Internal server error', stack?: string): ApiErrorResponse {
    return this.error(message, 'INTERNAL_ERROR', undefined, stack);
  }

  /**
   * Create response from Error object
   *
   * This automatically maps domain errors to appropriate response codes.
   *
   * @param error - Error object
   * @returns Error response object
   */
  static fromError(error: Error): ApiErrorResponse {
    // Map known error types
    if (error.name === 'ValidationError') {
      return this.validationError(
        (error as { errors?: Record<string, string[]> }).errors || {}
      );
    }

    if (error.name === 'NotFoundError') {
      return this.notFound((error as { resource?: string }).resource || 'Resource');
    }

    if (error.name === 'UnauthorizedError') {
      return this.unauthorized(error.message);
    }

    if (error.name === 'InvalidStatusTransitionError') {
      return this.badRequest(error.message);
    }

    // Default to internal error
    return this.internalError(error.message, error.stack);
  }
}

/**
 * HTTP status codes mapping
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Get HTTP status code from error code
 *
 * @param errorCode - Error code
 * @returns HTTP status code
 */
export function getHttpStatusFromErrorCode(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
    case 'BAD_REQUEST':
      return HTTP_STATUS.BAD_REQUEST;

    case 'UNAUTHORIZED':
      return HTTP_STATUS.UNAUTHORIZED;

    case 'FORBIDDEN':
      return HTTP_STATUS.FORBIDDEN;

    case 'NOT_FOUND':
      return HTTP_STATUS.NOT_FOUND;

    case 'CONFLICT':
      return HTTP_STATUS.CONFLICT;

    case 'INTERNAL_ERROR':
    default:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
}
