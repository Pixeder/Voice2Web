/*
 * VoiceReplica - Voice Engine Module
 * Handles speech recognition using Web Speech API
 * 
 * @module voiceEngine
 * @description Pure speech recognition engine with no UI dependencies
 * @version 1.0.0
 */

const VoiceEngine = (() => {
  'use strict';

  // ============================================================================
  // Private State
  // ============================================================================

  let recognition = null;
  let isInitialized = false;
  let isListening = false;
  let shouldAutoRestart = true;
  let restartTimeout = null;

  // Event callbacks storage
  const callbacks = {
    transcript: new Set(),
    error: new Set(),
    end: new Set(),
    stateChange: new Set()
  };

  // Configuration defaults
  const config = {
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
    restartDelay: 300 // ms delay before auto-restart
  };

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the speech recognition engine
   * Sets up Web Speech API with appropriate prefixes
   * 
   * @throws {Error} If Web Speech API is not supported
   * @returns {boolean} Success status
   */
  const initialize = () => {
    if (isInitialized) {
      return true;
    }

    // Check for Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      const error = new Error('Web Speech API is not supported in this browser');
      emitError({
        type: 'not-supported',
        message: error.message,
        fatal: true
      });
      throw error;
    }

    try {
      // Create recognition instance
      recognition = new SpeechRecognition();
      
      // Configure recognition settings
      recognition.continuous = config.continuous;
      recognition.interimResults = config.interimResults;
      recognition.maxAlternatives = config.maxAlternatives;
      recognition.lang = config.language;

      // Attach event handlers
      attachEventHandlers();

      isInitialized = true;
      return true;

    } catch (error) {
      emitError({
        type: 'initialization-failed',
        message: error.message,
        fatal: true
      });
      throw error;
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Attach all Web Speech API event handlers
   * @private
   */
  const attachEventHandlers = () => {
    recognition.onstart = handleStart;
    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;
  };

  /**
   * Handle recognition start event
   * @private
   */
  const handleStart = () => {
    isListening = true;
    clearRestartTimeout();
    emitStateChange({ state: 'listening', isListening: true });
  };

  /**
   * Handle recognition result event
   * Processes both interim and final transcripts
   * 
   * @private
   * @param {SpeechRecognitionEvent} event - Recognition result event
   */
  const handleResult = (event) => {
    const results = event.results;
    
    // Process all results from the last processed index
    for (let i = event.resultIndex; i < results.length; i++) {
      const result = results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      // Emit transcript with metadata
      emitTranscript({
        transcript: transcript.trim(),
        isFinal: isFinal,
        confidence: confidence,
        timestamp: Date.now()
      });
    }
  };

  /**
   * Handle recognition error event
   * Categorizes errors and determines if restart is needed
   * 
   * @private
   * @param {SpeechRecognitionErrorEvent} event - Error event
   */
  const handleError = (event) => {
    const errorType = event.error;
    const errorMap = {
      'no-speech': {
        type: 'no-speech',
        message: 'No speech was detected',
        recoverable: true
      },
      'audio-capture': {
        type: 'audio-capture',
        message: 'No microphone was found or microphone is not working',
        recoverable: false,
        fatal: true
      },
      'not-allowed': {
        type: 'permission-denied',
        message: 'Microphone permission was denied',
        recoverable: false,
        fatal: true
      },
      'network': {
        type: 'network',
        message: 'Network error occurred during recognition',
        recoverable: true
      },
      'aborted': {
        type: 'aborted',
        message: 'Recognition was aborted',
        recoverable: true
      },
      'service-not-allowed': {
        type: 'service-not-allowed',
        message: 'Speech recognition service is not allowed',
        recoverable: false,
        fatal: true
      }
    };

    const errorInfo = errorMap[errorType] || {
      type: 'unknown',
      message: `Unknown error: ${errorType}`,
      recoverable: false
    };

    isListening = false;
    emitError(errorInfo);
    emitStateChange({ state: 'error', isListening: false, error: errorInfo });

    // Don't auto-restart on fatal errors
    if (errorInfo.fatal) {
      shouldAutoRestart = false;
    }
  };

  /**
   * Handle recognition end event
   * Manages auto-restart logic
   * 
   * @private
   */
  const handleEnd = () => {
    isListening = false;
    emitEnd({ timestamp: Date.now() });
    emitStateChange({ state: 'stopped', isListening: false });

    // Auto-restart if enabled and not manually stopped
    if (shouldAutoRestart && isInitialized) {
      scheduleRestart();
    }
  };

  // ============================================================================
  // Control Methods
  // ============================================================================

  /**
   * Start speech recognition
   * 
   * @public
   * @throws {Error} If engine is not initialized
   * @returns {boolean} Success status
   */
  const start = () => {
    if (!isInitialized) {
      initialize();
    }

    if (isListening) {
      return true;
    }

    try {
      shouldAutoRestart = true;
      recognition.start();
      return true;
    } catch (error) {
      // Handle cases where recognition is already started
      if (error.name === 'InvalidStateError') {
        // Recognition is already running, consider this a success
        return true;
      }
      
      emitError({
        type: 'start-failed',
        message: error.message,
        recoverable: false
      });
      return false;
    }
  };

  /**
   * Stop speech recognition
   * Disables auto-restart
   * 
   * @public
   * @returns {boolean} Success status
   */
  const stop = () => {
    if (!isInitialized || !recognition) {
      return false;
    }

    try {
      shouldAutoRestart = false;
      clearRestartTimeout();
      
      if (isListening) {
        recognition.stop();
      }
      
      return true;
    } catch (error) {
      emitError({
        type: 'stop-failed',
        message: error.message,
        recoverable: true
      });
      return false;
    }
  };

  /**
   * Abort speech recognition immediately
   * More forceful than stop()
   * 
   * @public
   * @returns {boolean} Success status
   */
  const abort = () => {
    if (!isInitialized || !recognition) {
      return false;
    }

    try {
      shouldAutoRestart = false;
      clearRestartTimeout();
      recognition.abort();
      isListening = false;
      return true;
    } catch (error) {
      emitError({
        type: 'abort-failed',
        message: error.message,
        recoverable: false
      });
      return false;
    }
  };

  // ============================================================================
  // Auto-Restart Logic
  // ============================================================================

  /**
   * Schedule an automatic restart after a delay
   * Prevents rapid restart loops
   * 
   * @private
   */
  const scheduleRestart = () => {
    clearRestartTimeout();
    
    restartTimeout = setTimeout(() => {
      if (shouldAutoRestart && !isListening) {
        try {
          recognition.start();
        } catch (error) {
          // Silently handle restart failures
          emitError({
            type: 'restart-failed',
            message: error.message,
            recoverable: true
          });
        }
      }
    }, config.restartDelay);
  };

  /**
   * Clear any pending restart timeout
   * @private
   */
  const clearRestartTimeout = () => {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }
  };

  // ============================================================================
  // Event Emission
  // ============================================================================

  /**
   * Emit transcript to all registered callbacks
   * 
   * @private
   * @param {Object} data - Transcript data
   */
  const emitTranscript = (data) => {
    callbacks.transcript.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in transcript callback:', error);
      }
    });
  };

  /**
   * Emit error to all registered callbacks
   * 
   * @private
   * @param {Object} errorInfo - Error information
   */
  const emitError = (errorInfo) => {
    callbacks.error.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  };

  /**
   * Emit end event to all registered callbacks
   * 
   * @private
   * @param {Object} data - End event data
   */
  const emitEnd = (data) => {
    callbacks.end.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in end callback:', error);
      }
    });
  };

  /**
   * Emit state change to all registered callbacks
   * 
   * @private
   * @param {Object} data - State change data
   */
  const emitStateChange = (data) => {
    callbacks.stateChange.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  };

  // ============================================================================
  // Event Registration Methods
  // ============================================================================

  /**
   * Register a callback for transcript events
   * 
   * @public
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  const onTranscript = (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    callbacks.transcript.add(callback);
    
    // Return unsubscribe function
    return () => callbacks.transcript.delete(callback);
  };

  /**
   * Register a callback for error events
   * 
   * @public
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  const onError = (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    callbacks.error.add(callback);
    
    // Return unsubscribe function
    return () => callbacks.error.delete(callback);
  };

  /**
   * Register a callback for end events
   * 
   * @public
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  const onEnd = (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    callbacks.end.add(callback);
    
    // Return unsubscribe function
    return () => callbacks.end.delete(callback);
  };

  /**
   * Register a callback for state change events
   * 
   * @public
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  const onStateChange = (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    callbacks.stateChange.add(callback);
    
    // Return unsubscribe function
    return () => callbacks.stateChange.delete(callback);
  };

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Update engine configuration
   * 
   * @public
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  const configure = (options = {}) => {
    const wasListening = isListening;
    
    // Stop if currently listening
    if (wasListening) {
      stop();
    }

    // Update configuration
    if (options.language) config.language = options.language;
    if (typeof options.continuous === 'boolean') config.continuous = options.continuous;
    if (typeof options.interimResults === 'boolean') config.interimResults = options.interimResults;
    if (typeof options.maxAlternatives === 'number') config.maxAlternatives = options.maxAlternatives;
    if (typeof options.restartDelay === 'number') config.restartDelay = options.restartDelay;

    // Apply to recognition instance if initialized
    if (isInitialized && recognition) {
      recognition.lang = config.language;
      recognition.continuous = config.continuous;
      recognition.interimResults = config.interimResults;
      recognition.maxAlternatives = config.maxAlternatives;
    }

    // Restart if was listening
    if (wasListening) {
      start();
    }

    return true;
  };

  /**
   * Get current configuration
   * 
   * @public
   * @returns {Object} Current configuration
   */
  const getConfig = () => {
    return { ...config };
  };

  // ============================================================================
  // Status Methods
  // ============================================================================

  /**
   * Check if engine is currently listening
   * 
   * @public
   * @returns {boolean} Listening status
   */
  const getIsListening = () => {
    return isListening;
  };

  /**
   * Check if engine is initialized
   * 
   * @public
   * @returns {boolean} Initialization status
   */
  const getIsInitialized = () => {
    return isInitialized;
  };

  /**
   * Get comprehensive engine status
   * 
   * @public
   * @returns {Object} Engine status
   */
  const getStatus = () => {
    return {
      isInitialized,
      isListening,
      shouldAutoRestart,
      language: config.language,
      continuous: config.continuous,
      interimResults: config.interimResults
    };
  };

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy the engine and cleanup resources
   * 
   * @public
   */
  const destroy = () => {
    stop();
    
    // Clear all callbacks
    callbacks.transcript.clear();
    callbacks.error.clear();
    callbacks.end.clear();
    callbacks.stateChange.clear();
    
    // Cleanup recognition instance
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition = null;
    }
    
    isInitialized = false;
    isListening = false;
  };

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    // Control methods
    start,
    stop,
    abort,
    
    // Event registration
    onTranscript,
    onError,
    onEnd,
    onStateChange,
    
    // Configuration
    configure,
    getConfig,
    
    // Status
    getIsListening,
    getIsInitialized,
    getStatus,
    
    // Cleanup
    destroy
  };
})();

// ============================================================================
// Export
// ============================================================================

// Support both CommonJS and ES6 module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceEngine;
}

// For Chrome Extension usage
if (typeof window !== 'undefined') {
  window.VoiceEngine = VoiceEngine;
}