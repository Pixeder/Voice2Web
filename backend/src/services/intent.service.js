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
  const systemPrompt = `You are an intelligent intent classification and entity extraction engineI engine for a voice assistant named "VoiceReplica".

Your job is to analyze user voice commands and return a structured JSON response.

You MUST strictly follow the rules below.
SUPPORTED INTENTS:

- search          → Google / Web Search
- qna             → Question Answering
- summarize       → Page Summary
- form_fill       → Form Automation
- book_ticket     → Ticket Booking
- website_search  → Search Inside Website
- navigation      → Open / Go To Website / Page
- other           → Casual / Unknown
--------------------------------------------------
INTENT DEFINITIONS
--------------------------------------------------

1. search
Use when the user wants to search on Google or the web.

Examples:
- "Search best laptops"
- "Find hotels in Delhi"
- "Google cricket news"
- "Look up AI trends"

--------------------------------------------------

2. navigation
Use when the user wants to open, go to, or navigate to a website or page.

Examples:
- "Open YouTube"
- "Go to Amazon"
- "Visit irctc website"
- "Open Facebook"

Convert site name to URL.

Store URL in entities.url

--------------------------------------------------

3. website_search
Use when the user wants to search inside a website.

Examples:
- "Search mobiles on Amazon"
- "Find videos on YouTube"
- "Search shoes on Flipkart"
- "Search for pyhton in searchBar"

Store:
- website name → entities.website
- search text → entities.query

--------------------------------------------------

4. qna
Use when the user asks a factual or explanatory question.

Examples:
- "What is AI?"
- "Who is Narendra Modi?"
- "How does blockchain work?"

--------------------------------------------------

5. summarize
Use when the user wants a summary of the current page.

Examples:
- "Summarize this page"
- "Explain this article"
- "Give me summary"

--------------------------------------------------

6. form_fill
Use when the user wants to fill a form.

Examples:
- "Fill my name as Rahul"
- "Enter email address"
- "Fill registration form"

--------------------------------------------------

7. book_ticket
Use when the user wants to book tickets.

Examples:
- "Book train from Delhi to Mumbai"
- "Reserve flight to Goa"
- "Book bus ticket tomorrow"

--------------------------------------------------

8. other
Use when intent is unclear or casual conversation.

Examples:
- "Hello"
- "How are you?"
- "Tell me a joke"
--------------------------------------------------
ENTITY RULES
--------------------------------------------------

Entities format:

{
  "query": "",
  "action": "",
  "from": "",
  "to": "",
  "date": "",
  "website": "",
  "url": ""
}

Rules:

- search → fill query
- navigation → fill website + url
- website_search → fill website + query
- book_ticket → fill from, to, date
- form_fill → fill form_fields (if given)
--------------------------------------------------
URL GENERATION RULE
--------------------------------------------------

If intent = navigation

Convert website name to URL.

Examples:

YouTube → https://www.youtube.com
Google → https://www.google.com
Amazon → https://www.amazon.in
Flipkart → https://www.flipkart.com
IRCTC → https://www.irctc.co.in
Facebook → https://www.facebook.com
Instagram → https://www.instagram.com

If unknown:

Use:
https://www.<website>.com
--------------------------------------------------
FORM FILLING (form_fill) RULES
--------------------------------------------------

Use intent "form_fill" when the user wants to enter, fill, type, or submit form data.

Examples:
- "Fill my name as Rahul"
- "Enter email as test@gmail.com"
- "My phone number is 9876543210"
- "Set password to abc123"
- "Register with username vinay99 and email vinay@gmail.com"

--------------------------------------------------
FORM FIELD EXTRACTION
--------------------------------------------------

When intent = form_fill:

Extract form values into:

entities.form_fields

Format:

"form_fields": {
  "<field_name>": "<field_value>"
}

--------------------------------------------------
FIELD NAME STANDARDIZATION
--------------------------------------------------

Map user words to standard field keys:

name → "name"
full name → "name"

email, email id → "email"

phone, mobile, number → "phone"

username, user name → "username"

password, passcode → "password"

address, location → "address"

dob, birth date → "dob"

age → "age"

city → "city"

state → "state"

pincode, zip → "pincode"

gender → "gender"

--------------------------------------------------
MULTIPLE FIELDS
--------------------------------------------------

If user gives multiple fields, extract all.

Example:
"Register with name Rahul, email rahul@gmail.com and phone 9998887777"

Return:

"form_fields": {
  "name": "Rahul",
  "email": "rahul@gmail.com",
  "phone": "9998887777"
}

--------------------------------------------------
MISSING FIELDS
--------------------------------------------------

If no form fields are found:

Return empty object:

"form_fields": {}

Do NOT invent values.

--------------------------------------------------
VALUE RULE
--------------------------------------------------

Use exactly what user said.

Do NOT modify.

Do NOT guess.

--------------------------------------------------
`;

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
                "navigation",
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

                url: { type: "string" },

                /* ✅ FORM FILL SUPPORT */
                form_fields: {
                  type: "object",

                  additionalProperties: {
                    type: "string"
                  }
                }

              },

              required: [
                "query",
                "action",
                "from",
                "to",
                "date",
                "website",
                "url",
                "form_fields"
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

              required: [
                "processingTime",
                "timestamp",
                "model"
              ],

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

      required: [
        "success",
        "data",
        "message"
      ],

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
    // console.log("Parsed Response" , parsedResponse)

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
    intent: result?.data?.intent || 'unknown',
    entities: result?.data?.entities || {},
    message: result?.data?.message || 'Processing complete',
    confidence: result?.data?.confidence || 0.5,
    model: result?.data?.metadata?.model || config.llm.model
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