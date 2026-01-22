/**
 * Standardized Error Response Handler
 * Provides consistent error responses across all API endpoints
 */

import crypto from 'crypto';
import logger from './logger.js';

/**
 * Standard error codes for API responses
 */
export const ErrorCodes = {
  // Authentication errors (401)
  NO_TOKEN: 'NO_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_API_KEY: 'MISSING_API_KEY',

  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',

  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource errors (404)
  NOT_FOUND: 'NOT_FOUND',
  LEAD_NOT_FOUND: 'LEAD_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  WEBSITE_NOT_FOUND: 'WEBSITE_NOT_FOUND',

  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',
  API_LIMIT_EXCEEDED: 'API_LIMIT_EXCEEDED',
  LEAD_LIMIT_EXCEEDED: 'LEAD_LIMIT_EXCEEDED',

  // Conflict errors (409)
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};

/**
 * Create a standardized error response object
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - User-friendly error message
 * @param {any} details - Additional error details (only in development)
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(code, message, details = null) {
  const response = {
    success: false,
    error: {
      code,
      message
    }
  };

  // Only include details in development mode
  if (process.env.NODE_ENV === 'development' && details) {
    response.error.details = details;
  }

  return response;
}

/**
 * Create a standardized success response object
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 * @returns {Object} Standardized success response
 */
export function createSuccessResponse(data, message = null) {
  const response = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * Express error handling middleware
 * Place this after all routes
 */
export function errorMiddleware(err, req, res, next) {
  const errorId = crypto.randomUUID();

  // Log the full error server-side
  logger.error(`Error [${errorId}]:`, {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    tenantId: req.tenant?.tenant_id
  });

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;

  // Send sanitized response to client
  res.status(statusCode).json(
    createErrorResponse(
      err.code || ErrorCodes.INTERNAL_ERROR,
      err.userMessage || 'An unexpected error occurred',
      err.message
    )
  );
}

/**
 * Async route handler wrapper
 * Catches async errors and passes them to error middleware
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a custom API error
 * @param {number} status - HTTP status code
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - User-friendly message
 * @returns {Error} Custom error object
 */
export function createApiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.userMessage = message;
  return error;
}

export default {
  ErrorCodes,
  createErrorResponse,
  createSuccessResponse,
  errorMiddleware,
  asyncHandler,
  createApiError
};
