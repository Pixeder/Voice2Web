/**
 * VoiceReplica Backend - Server Entry Point
 * Initializes and starts the HTTP server
 * 
 * @module server
 * @description Application entry point - loads environment and starts server
 */

import dotenv from 'dotenv';
import app from './app.js';
import { config } from './config/env.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

// ============================================================================
// Server Configuration
// ============================================================================

const PORT = config.port;
const HOST = config.host;
const ENV = config.env;

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Start the HTTP server
 */
const startServer = () => {
  try {
    const server = app.listen(PORT, HOST, () => {
      logger.info('='.repeat(60));
      logger.info(`🚀 VoiceReplica Backend Server Started`);
      logger.info(`📍 Environment: ${ENV}`);
      logger.info(`🌐 Server running at: http://${HOST}:${PORT}`);
      logger.info(`⏰ Started at: ${new Date().toISOString()}`);
      logger.info('='.repeat(60));
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('✅ HTTP server closed');
        logger.info('👋 Process terminated gracefully');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ============================================================================
// Initialize Server
// ============================================================================

startServer();