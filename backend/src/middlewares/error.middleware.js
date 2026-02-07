/**
 * Error Handling Middleware
 * Centralized error handling for the application
 * 
 * @module middlewares/error
 */

import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

// ============================================================================
// 404 Not Found Handler
// ============================================================================

/**
 * Handle 404 - Route not found
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `Route ${req.originalUrl} not found`);
  next(error);
};

// ============================================================================
// Global Error Handler
// ============================================================================

/**
 * Global error handling middleware
 * Catches all errors and returns formatted JSON response
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert non-ApiError errors to ApiError
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  // Prepare response
  const response = {
    success: false,
    message: error.message,
    ...(config.env === 'development' && {
      stack: error.stack,
      originalError: err
    })
  };

  // Log error
  if (error.statusCode >= 500) {
    logger.error('Server Error:', {
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
      stack: error.stack
    });
  } else {
    logger.warn('Client Error:', {
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method
    });
  }

  // Send response
  res.status(error.statusCode).json(response);
};