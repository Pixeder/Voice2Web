/**
 * Process Controller
 * Handles HTTP requests for voice command processing
 * 
 * @module controllers/process
 */

import { processIntent } from '../services/intent.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

// ============================================================================
// Process Voice Command
// ============================================================================

/**
 * Process user voice command
 * Receives text, processes through LLM, returns structured response
 * 
 * @async
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const processVoiceCommand = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const startTime = Date.now();

  logger.info(`Processing command: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

  // Process through intent service
  const result = await processIntent(text);
  console.log("result " ,result)

  const processingTime = Date.now() - startTime;

  logger.info(`Command processed successfully - Intent: ${result.intent} (${processingTime}ms)`);

  // Send success response
  res.status(200).json(
    new ApiResponse(
      true,
      {
        intent: result.intent,
        entities: result.entities,
        message: result.message,
        confidence: result.confidence,
        metadata: {
          processingTime: `${processingTime}ms`,
          timestamp: new Date().toISOString(),
          model: result.model
        }
      },
      'Command processed successfully'
    )
  );
});