/**
 * Environment Configuration
 * Centralizes all environment variables and app configuration
 * 
 * @module config/env
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Application configuration object
 * @type {Object}
 */
export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Rate Limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests

  // LLM API Configuration
  llm: {
    provider: process.env.LLM_PROVIDER || 'grok', // grok, openai, anthropic
    apiKey: process.env.LLM_API_KEY || '',
    apiUrl: process.env.LLM_API_URL || 'https://api.x.ai/v1/chat/completions',
    model: process.env.LLM_MODEL || 'grok-beta',
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '500', 10),
    timeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10), // 30 seconds
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info', // error, warn, info, debug

  // Request validation
  maxTextLength: parseInt(process.env.MAX_TEXT_LENGTH || '1000', 10),
};

/**
 * Validate required environment variables
 */
export const validateConfig = () => {
  const required = [];

  if (config.env === 'production') {
    if (!config.llm.apiKey) {
      required.push('LLM_API_KEY');
    }
  }

  if (required.length > 0) {
    throw new Error(
      `Missing required environment variables: ${required.join(', ')}`
    );
  }
};

// Validate on import
validateConfig();