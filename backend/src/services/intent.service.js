/**
 * Intent Service
 * Business logic for intent recognition using Grok AI SDK
 * 
 * @module services/intent
 */

import OpenAI from 'openai';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';

// ============================================================================
// Grok AI Client Initialization
// ============================================================================

let grokClient = null;

/**
 * Initialize Grok AI client
 * Uses OpenAI SDK compatible with Grok API
 */
const initializeGrokClient = () => {
  if (!config.llm.apiKey) {
    logger.warn('Grok API key not configured - using fallback mode');
    return null;
  }

  try {
    grokClient = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.apiUrl, // Base URL without endpoint
    });
    
    logger.info('✅ Grok AI client initialized successfully');
    return grokClient;
  } catch (error) {
    logger.error('Failed to initialize Grok client:', error.message);
    return null;
  }
};

// Initialize on module load
initializeGrokClient();

// ============================================================================
// LLM Integration with Grok SDK
// ============================================================================

/**
 * Call Grok AI using official SDK
 * 
 * @async
 * @param {string} userText - User's voice command
 * @returns {Promise<Object>} Grok response with intent data
 * @throws {ApiError} If Grok API call fails
 */
const callGrok = async (userText) => {
  const systemPrompt = `You are an intent detection and response generation engine for a voice-based assistant named VoiceReplica.

Your task is to analyze the user command and return a structured JSON API response.

---

STRICT RULES:

1. Return ONLY valid JSON.
2. Do NOT include explanations.
3. Do NOT include markdown.
4. Do NOT include extra text.
5. Do NOT wrap in code blocks.
6. Follow the output format exactly.
7. Do NOT invent missing data.
8. Use lowercase intent names.

---

SUPPORTED INTENTS:

- search
- qna
- summarize
- form_fill
- book_ticket
- website_search
- open_site
- other

---

ENTITY EXTRACTION RULES:

- Extract only explicitly mentioned entities.
- If not found, use empty string "".
- Do NOT guess.
- Keep structure consistent.

---

CONFIDENCE RULE:

- Return confidence between 0.70 and 0.95.
- Higher if intent is clear.
- Lower if ambiguous.

---

OUTPUT FORMAT (MANDATORY):

Return JSON in this exact structure:

{
  "success": true,
  "data": {
    "intent": "<intent_name>",
    "entities": {
      "query": "",
      "action": "",
      "from": "",
      "to": "",
      "date": "",
      "website": ""
    },
    "message": "",
    "confidence": 0.0,
    "metadata": {
      "processingTime": "",
      "timestamp": "",
      "model": "grok-llm"
    }
  },
  "message": "Command processed successfully"
}

---

MESSAGE GENERATION RULE:

Generate a natural language message explaining what action will be taken.

Examples:
- "I'll help you search for \"best laptops\"."
- "Opening YouTube for you."
- "Here is the summary of this page."
- "Let me answer your question."

---

TIMESTAMP RULE:

Use ISO format:
YYYY-MM-DDTHH:MM:SS.sssZ

Example:
2026-02-07T07:39:45.425Z

---

USER COMMAND:

"{{USER_TEXT}}"`;

  const finalPrompt = systemPrompt + `\n\n` + `Analyze the following user command and generate a structured response in the required JSON format.Follow all system rules strictly.User Command: ${userText}`

  try {
    // Check if client is initialized
    if (!grokClient) {
      logger.warn('Grok client not initialized, using fallback');
      return fallbackIntentRecognition(userText);
    }

    logger.debug(`Calling Grok AI: ${config.llm.model}`);

    // Call Grok using OpenAI SDK
    const completion = await grokClient.responses.create({
      model: config.llm.model,
      input: finalPrompt,
      temperature: config.llm.temperature,
      text: {
  format: {
    type: "json_schema",
    name: "voice_replica_intent_response",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean"
        },

        data: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: [
                "search",
                "qna",
                "summarize",
                "form_fill",
                "book_ticket",
                "website_search",
                "open_site",
                "other"
              ]
            },

            entities: {
              type: "object",
              properties: {
                query: { type: "string" },
                action: { type: "string" },
                from: { type: "string" },
                to: { type: "string" },
                date: { type: "string" },
                website: { type: "string" },

                form_fields: {
                  type: "object",
                  additionalProperties: {
                    type: "string"
                  }
                },

                keywords: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: [
                "query",
                "action",
                "from",
                "to",
                "date",
                "website",
                "form_fields",
                "keywords"
              ],
              additionalProperties: false
            },

            message: {
              type: "string"
            },

            confidence: {
              type: "number",
              minimum: 0.7,
              maximum: 0.95
            },

            metadata: {
              type: "object",
              properties: {
                processingTime: {
                  type: "string"
                },

                timestamp: {
                  type: "string",
                  format: "date-time"
                },

                model: {
                  type: "string"
                }
              },
              required: ["processingTime", "timestamp", "model"],
              additionalProperties: false
            }
          },

          required: [
            "intent",
            "entities",
            "message",
            "confidence",
            "metadata"
          ],

          additionalProperties: false
        },

        message: {
          type: "string"
        }
      },

      required: ["success", "data", "message"],

      additionalProperties: false
    }
  }
}
, // Force JSON response
    });
    // console.log(completion.output_text);
    // return completion;
    const content = completion.output_text;
    logger.debug('Grok Response:', content);

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Grok response is not valid JSON');
      }
      parsedResponse = JSON.parse(jsonMatch[0]);
    }

    // // Validate response structure
    // if (!parsedResponse.intent || !parsedResponse.message) {
    //   throw new Error('Grok response missing required fields');
    // }

    // // Ensure entities exists
    // if (!parsedResponse.entities) {
    //   parsedResponse.entities = {};
    // }

    // // Ensure confidence exists
    // if (!parsedResponse.confidence) {
    //   parsedResponse.confidence = 0.75;
    // }
    console.log("Parsed Response" , parsedResponse)

    return parsedResponse;

  } catch (error) {
    logger.error('Grok API call failed:', error);

    // Check for specific error types
    if (error.status === 401) {
      logger.error('Invalid Grok API key');
      throw new ApiError(502, 'Invalid LLM API key configuration');
    }

    if (error.status === 429) {
      logger.error('Grok rate limit exceeded');
      throw new ApiError(429, 'Rate limit exceeded. Please try again later.');
    }

    if (error.status === 500 || error.status === 503) {
      logger.error('Grok service unavailable');
      logger.warn('Using fallback intent recognition');
      return fallbackIntentRecognition(userText);
    }

    // Use fallback for other errors
    logger.warn('Using fallback intent recognition due to Grok error');
    return fallbackIntentRecognition(userText);
  }
};

/**
 * Fallback intent recognition when Grok is unavailable
 * Rule-based pattern matching system
 * 
 * @param {string} text - User command text
 * @returns {Object} Intent recognition result
 */
const fallbackIntentRecognition = (text) => {
  const lowerText = text.toLowerCase().trim();

  // Define comprehensive patterns
  const patterns = {
    greeting: {
      keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
      message: "Hello! I'm VoiceReplica. How can I help you today?",
      confidence: 0.85
    },
    farewell: {
      keywords: ['bye', 'goodbye', 'see you', 'farewell', 'good night'],
      message: "Goodbye! Have a great day!",
      confidence: 0.85
    },
    thanks: {
      keywords: ['thank', 'thanks', 'appreciate', 'grateful'],
      message: "You're welcome! Happy to help!",
      confidence: 0.85
    },
    help: {
      keywords: ['help', 'assist', 'what can you do', 'support'],
      message: "I can help you with:\n• Answering questions\n• Checking time and date\n• Opening websites\n• Setting reminders\n• Simple calculations\n• Telling jokes\n• And much more!",
      confidence: 0.80
    },
    time: {
      keywords: ['time', 'what time', "what's the time", 'current time'],
      handler: () => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: true 
        });
        return {
          message: `The current time is ${timeString}.`,
          entities: { time: timeString }
        };
      },
      confidence: 0.90
    },
    date: {
      keywords: ['date', 'what date', "what's the date", 'today', 'what day'],
      handler: () => {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { 
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        return {
          message: `Today is ${dateString}.`,
          entities: { date: dateString }
        };
      },
      confidence: 0.90
    },
    weather: {
      keywords: ['weather', 'temperature', 'forecast', 'raining', 'sunny', 'cloudy'],
      message: "I don't have real-time weather data yet, but you can check your local weather service!",
      confidence: 0.75,
      entities: { needsWeatherAPI: true }
    },
    search: {
      keywords: ['search for', 'look up', 'find', 'google'],
      handler: (text) => {
        const query = text.replace(/search for|look up|find|google/gi, '').trim();
        return {
          message: `I'll help you search for "${query}".`,
          entities: { query, action: 'search' }
        };
      },
      confidence: 0.85
    },
    open_website: {
      keywords: ['open', 'go to', 'navigate to', 'visit', 'launch'],
      handler: (text) => {
        const siteMatch = text.match(/(?:open|go to|navigate to|visit|launch)\s+(.+)/i);
        const site = siteMatch ? siteMatch[1].trim() : 'the website';
        return {
          message: `Opening ${site}...`,
          entities: { website: site, action: 'open' }
        };
      },
      confidence: 0.88
    },
    reminder: {
      keywords: ['remind me', 'set reminder', 'remember to', "don't forget"],
      handler: (text) => {
        const reminderMatch = text.match(/remind me (?:to )?(.+)/i);
        const reminder = reminderMatch ? reminderMatch[1].trim() : 'that';
        
        // Try to extract time
        const timeMatch = reminder.match(/at (\d{1,2}:\d{2}(?:\s?(?:am|pm))?|\d{1,2}\s?(?:am|pm))/i);
        const time = timeMatch ? timeMatch[1] : null;
        const task = time ? reminder.replace(/at .+/i, '').trim() : reminder;
        
        return {
          message: `I'll remind you to ${task}${time ? ` at ${time}` : ''}.`,
          entities: { task, time, action: 'reminder' }
        };
      },
      confidence: 0.82
    },
    calculation: {
      keywords: ['calculate', 'what is', 'plus', 'minus', 'times', 'divided', 'multiply', 'add', 'subtract'],
      handler: (text) => {
        try {
          const mathMatch = text.match(/(?:calculate|what is)\s+(.+)/i);
          let expression = mathMatch ? mathMatch[1] : text;
          
          // Replace words with operators
          expression = expression
            .replace(/plus/gi, '+')
            .replace(/add/gi, '+')
            .replace(/minus/gi, '-')
            .replace(/subtract/gi, '-')
            .replace(/times/gi, '*')
            .replace(/multiply(?:ed)? by/gi, '*')
            .replace(/divided by/gi, '/')
            .replace(/[^0-9+\-*/().\s]/g, '')
            .trim();
          
          // Only evaluate if expression looks safe
          if (/^[0-9+\-*/().\s]+$/.test(expression)) {
            const result = eval(expression);
            return {
              message: `The answer is ${result}.`,
              entities: { expression, result, action: 'calculate' }
            };
          }
          
          return {
            message: "I couldn't understand that calculation. Try asking like 'what is 5 plus 3?'",
            entities: {}
          };
        } catch (error) {
          return {
            message: "Sorry, I couldn't calculate that. Please try again.",
            entities: {}
          };
        }
      },
      confidence: 0.85
    },
    joke: {
      keywords: ['joke', 'make me laugh', 'something funny', 'tell me a joke', 'funny'],
      handler: () => {
        const jokes = [
          "Why don't scientists trust atoms? Because they make up everything!",
          "I told my wife she was drawing her eyebrows too high. She looked surprised.",
          "Why did the scarecrow win an award? He was outstanding in his field!",
          "What do you call a fake noodle? An impasta!",
          "Why don't eggs tell jokes? They'd crack each other up!",
          "What do you call a bear with no teeth? A gummy bear!",
          "Why did the math book look sad? Because it had too many problems.",
          "What do you call a pile of cats? A meowtain!",
          "Why don't oysters donate to charity? Because they're shellfish!",
          "What did the ocean say to the beach? Nothing, it just waved!"
        ];
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        return {
          message: joke,
          entities: { type: 'joke' }
        };
      },
      confidence: 0.80
    }
  };

  // Match pattern
  for (const [intent, data] of Object.entries(patterns)) {
    for (const keyword of data.keywords) {
      if (lowerText.includes(keyword)) {
        let message = data.message;
        let entities = data.entities || {};
        
        // Use handler if available
        if (data.handler) {
          const result = data.handler(text);
          message = result.message;
          entities = { ...entities, ...result.entities };
        }
        
        return {
          intent,
          entities: { ...entities, ...extractEntities(text) },
          message,
          confidence: data.confidence,
          model: 'fallback-rule-based'
        };
      }
    }
  }

  // No match - unknown intent
  return {
    intent: 'unknown',
    entities: extractEntities(text),
    message: `I heard: "${text}". I'm not sure how to help with that yet. Try saying 'help' to see what I can do!`,
    confidence: 0.30,
    model: 'fallback-rule-based'
  };
};

/**
 * Extract entities from text using pattern matching
 * 
 * @param {string} text - Input text
 * @returns {Object} Extracted entities
 */
const extractEntities = (text) => {
  const entities = {};

  // Extract numbers
  const numbers = text.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    entities.numbers = numbers.map(n => parseInt(n));
  }

  // Extract time expressions
  const timeMatch = text.match(/\d{1,2}:\d{2}\s?(?:am|pm)?|\d{1,2}\s?(?:am|pm)/gi);
  if (timeMatch) {
    entities.time = timeMatch[0];
  }

  // Extract URLs
  const urlMatch = text.match(/https?:\/\/[^\s]+/g);
  if (urlMatch) {
    entities.url = urlMatch[0];
  }

  // Extract email addresses
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatch) {
    entities.email = emailMatch[0];
  }

  // Extract dates (simple patterns)
  const datePatterns = [
    /\d{1,2}\/\d{1,2}\/\d{2,4}/g, // MM/DD/YYYY
    /\d{4}-\d{2}-\d{2}/g, // YYYY-MM-DD
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      entities.date = match[0];
      break;
    }
  }

  return entities;
};

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process user intent using Grok AI or fallback
 * Main entry point for intent recognition
 * 
 * @async
 * @param {string} text - User's voice command
 * @returns {Promise<Object>} Processed intent with response
 * @throws {ApiError} If processing fails
 */
export const processIntent = async (text) => {
  try {
    // Validate input
    if (!text || typeof text !== 'string') {
      throw new ApiError(400, 'Invalid text input');
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new ApiError(400, 'Text cannot be empty');
    }

    if (trimmedText.length > config.maxTextLength) {
      throw new ApiError(400, `Text exceeds maximum length of ${config.maxTextLength} characters`);
    }

    // Process with Grok or fallback
    const result = await callGrok(trimmedText);

    // Ensure all required fields are present
    return {
      intent: result.intent || 'unknown',
      entities: result.entities || {},
      message: result.message || 'Processing complete',
      confidence: result.confidence || 0.5,
      model: result.model || config.llm.model
    };

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error('Intent processing error:', error);
    throw new ApiError(500, 'Failed to process intent');
  }
};

// ============================================================================
// Reinitialize Client (useful for config updates)
// ============================================================================

/**
 * Reinitialize Grok client with updated configuration
 * Useful when API key is updated at runtime
 * 
 * @returns {boolean} Success status
 */
export const reinitializeGrokClient = () => {
  logger.info('Reinitializing Grok client...');
  grokClient = initializeGrokClient();
  return grokClient !== null;
};