/**
 * Process Routes
 * Defines API routes for voice command processing
 * 
 * @module routes/process
 */

import express from 'express';
import { processVoiceCommand } from '../controllers/process.controller.js';
import { validateProcessRequest } from '../middlewares/validate.middleware.js';

const router = express.Router();

// ============================================================================
// POST /api/process
// Process voice command and return intent + response
// ============================================================================

/**
 * @route   POST /api/process
 * @desc    Process user voice command through LLM
 * @access  Public
 * @body    { text: string }
 * @returns { success, intent, entities, message, confidence }
 */
router.post('/process', validateProcessRequest, processVoiceCommand);

export default router;