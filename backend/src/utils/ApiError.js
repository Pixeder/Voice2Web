/**
 * Custom API Error Class
 * Extends Error with HTTP status code
 * 
 * @module utils/ApiError
 */

/**
 * API Error class
 * @extends Error
 */
export class ApiError extends Error {
  /**
   * Create an API error
   * 
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {boolean} isOperational - Whether error is operational
   * @param {string} stack - Stack trace
   */
  constructor(
    statusCode,
    message = 'Something went wrong',
    isOperational = true,
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}