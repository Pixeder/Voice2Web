/**
 * Validation Middleware
 * Validates incoming requests using Joi
 * 
 * @module middlewares/validate
 */

import Joi from 'joi';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/env.js';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for /api/process endpoint
 */
const processSchema = Joi.object({
  text: Joi.string()
    .trim()
    .min(1)
    .max(config.maxTextLength)
    .required()
    .messages({
      'string.empty': 'Text field cannot be empty',
      'string.min': 'Text must be at least 1 character',
      'string.max': `Text cannot exceed ${config.maxTextLength} characters`,
      'any.required': 'Text field is required'
    })
});

// ============================================================================
// Validation Middleware
// ============================================================================

/**
 * Validate request body against schema
 * 
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      throw new ApiError(400, errorMessage);
    }

    // Replace request body with validated value
    req.body = value;
    next();
  };
};

/**
 * Validate process request
 */
export const validateProcessRequest = validate(processSchema);