/**
 * Async Handler Utility
 * Wraps async route handlers to catch errors
 * 
 * @module utils/asyncHandler
 */

/**
 * Async handler wrapper
 * Eliminates need for try-catch in route handlers
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};