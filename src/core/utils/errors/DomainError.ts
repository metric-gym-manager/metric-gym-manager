/**
 * Domain Error Classes
 *
 * These error classes represent domain-specific errors in the application.
 * They should be thrown by domain entities, use cases, and business logic.
 */

/**
 * Base domain error class
 *
 * All domain errors should extend this class.
 */
export class DomainError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: string;

  /**
   * HTTP status code suggestion
   */
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = statusCode;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error
 *
 * Thrown when input data fails validation.
 */
export class ValidationError extends DomainError {
  /**
   * Validation errors by field name
   */
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.errors = errors;
  }

  /**
   * Create validation error from field error
   *
   * @param field - Field name
   * @param messages - Error messages
   * @returns ValidationError instance
   */
  static fromField(field: string, ...messages: string[]): ValidationError {
    return new ValidationError('Validation failed', { [field]: messages });
  }

  /**
   * Create validation error from multiple field errors
   *
   * @param errors - Errors by field name
   * @returns ValidationError instance
   */
  static fromFields(errors: Record<string, string[]>): ValidationError {
    return new ValidationError('Validation failed', errors);
  }
}

/**
 * Not found error
 *
 * Thrown when a requested resource is not found.
 */
export class NotFoundError extends DomainError {
  /**
   * Resource name
   */
  public readonly resource: string;

  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * Unauthorized error
 *
 * Thrown when user is not authenticated.
 */
export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error
 *
 * Thrown when user does not have permission to perform an action.
 */
export class ForbiddenError extends DomainError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Invalid status transition error
 *
 * Thrown when attempting an invalid member status transition.
 */
export class InvalidStatusTransitionError extends DomainError {
  /**
   * Current status
   */
  public readonly from: string;

  /**
   * Attempted target status
   */
  public readonly to: string;

  constructor(from: string, to: string) {
    super(
      `Cannot transition from ${from} to ${to}`,
      'INVALID_STATUS_TRANSITION',
      400
    );
    this.name = 'InvalidStatusTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Payment calculation error
 *
 * Thrown when payment calculations fail.
 */
export class PaymentCalculationError extends DomainError {
  constructor(message: string) {
    super(message, 'PAYMENT_CALCULATION_ERROR', 400);
    this.name = 'PaymentCalculationError';
  }
}

/**
 * Business rule violation error
 *
 * Thrown when a business rule is violated.
 */
export class BusinessRuleViolationError extends DomainError {
  /**
   * Rule that was violated
   */
  public readonly rule: string;

  constructor(message: string, rule: string) {
    super(message, 'BUSINESS_RULE_VIOLATION', 400);
    this.name = 'BusinessRuleViolationError';
    this.rule = rule;
  }
}

/**
 * Conflict error
 *
 * Thrown when an operation conflicts with existing data (e.g., duplicate entry).
 */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/**
 * Database error
 *
 * Thrown when database operations fail.
 */
export class DatabaseError extends DomainError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

/**
 * External service error
 *
 * Thrown when external service (SMS, storage, etc.) fails.
 */
export class ExternalServiceError extends DomainError {
  /**
   * Service name
   */
  public readonly service: string;

  constructor(service: string, message: string) {
    super(`${service} error: ${message}`, 'EXTERNAL_SERVICE_ERROR', 500);
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

/**
 * SMS sending error
 *
 * Thrown when SMS sending fails.
 */
export class SMSSendError extends ExternalServiceError {
  constructor(message: string) {
    super('SMS Provider', message);
    this.name = 'SMSSendError';
  }
}

/**
 * Check if error is a domain error
 *
 * @param error - Error to check
 * @returns True if domain error
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Check if error is a validation error
 *
 * @param error - Error to check
 * @returns True if validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if error is a not found error
 *
 * @param error - Error to check
 * @returns True if not found error
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Get error code from any error
 *
 * @param error - Error object
 * @returns Error code
 */
export function getErrorCode(error: unknown): string {
  if (isDomainError(error)) {
    return error.code;
  }
  return 'INTERNAL_ERROR';
}

/**
 * Get HTTP status code from any error
 *
 * @param error - Error object
 * @returns HTTP status code
 */
export function getErrorStatusCode(error: unknown): number {
  if (isDomainError(error)) {
    return error.statusCode;
  }
  return 500;
}
