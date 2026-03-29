// const { OpenAI } = require('openai');
// const { zodResponseFormat } = require('openai/helpers/zod');
// const { ZooplaResponseSchema } = require('./zooplaSchemas');

// class OpenAIService {
//   constructor() {
//     this.openai = new OpenAI({
//       apiKey: process.env.OPENAI_API_KEY
//     });
//   }

//   async extractFiltersFromMessage(message) {
//     try {
//       const completion = await this.openai.beta.chat.completions.parse({
//         model: 'gpt-4o',
//         messages: [
//           {
//             role: 'system',
//             content: this._getSystemPrompt()
//           },
//           { role: 'user', content: message },
//         ],
//         response_format: zodResponseFormat(ZooplaResponseSchema, 'filters_extracted'),
//       });

//       return completion.choices[0].message.parsed;
//     } catch (error) {
//       console.error('OpenAI extraction error:', error);
//       // Return fallback response
//       return this._getFallbackResponse();
//     }
//   }

//   _getSystemPrompt() {
//     return `
// You are a helpful assistant that extracts structured Zoopla-style search filters from natural language user prompts.

// Your job is to:
// 1. Extract explicit filters like bedrooms, prices, location, and type of listing.
// 2. Infer **implicit preferences** from the user's language:
//    - "kids", "family", "school", "park", "football" → keywords like "family friendly", "near parks", or "near schools"
//    - "budget", "cheap", "affordable" → price filters
//    - "looking to rent/buy" or synonyms → set the appropriate 'section'

// You must return:
// - A 'filters' object that follows the ZooplaFilterSchema.
// - An 'explanation' string that describes what was inferred.

// Ensure that both 'locationValue' and 'locationIdentifier' are provided.
// If unsure of the identifier, you may guess using the location name in lowercase with spaces replaced by hyphens (e.g., "Oxford" → "oxford").

// Example prompt:
// "I have two young kids aged 5 and 9. We're moving to Oxford and want a home with access to parks and schools."

// Expected output:
// {
//   filters: {
//     locationValue: "Oxford",
//     locationIdentifier: "oxford",
//     section: "for-sale",
//     keywords: "near parks, near schools",
//     feature: "family_friendly"
//   },
//   explanation: "User is looking for a family-friendly property in Oxford near parks and schools, inferred from mention of kids and activities."
// }
// `;
//   }

//   _getFallbackResponse() {
//     return {
//       filters: {
//         locationValue: "Oxford",
//         locationIdentifier: "oxford"
//       },
//       explanation: "Failed to parse user message, using default Oxford search"
//     };
//   }
// }

// module.exports = new OpenAIService();