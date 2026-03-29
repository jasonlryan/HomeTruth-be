// const { LIMITS } = require('./constants');

// class FilterUtils {
//   static cleanFilters(filters) {
//     const cleaned = { ...filters };
    
//     // Clean up numeric filters - remove if 0 or negative, set defaults
//     cleaned.bedsMin = filters.bedsMin > 0 ? filters.bedsMin : undefined;
//     cleaned.bedsMax = filters.bedsMax > 0 ? filters.bedsMax : undefined;
//     cleaned.priceMin = filters.priceMin > 0 ? filters.priceMin : undefined;
//     cleaned.priceMax = filters.priceMax > 0 ? filters.priceMax : undefined;
//     cleaned.radius = filters.radius > 0 ? filters.radius : LIMITS.DEFAULT_RADIUS;
//     cleaned.page = filters.page > 0 ? filters.page : LIMITS.DEFAULT_PAGE;
//     cleaned.pageSize = filters.pageSize > 0 ? filters.pageSize : LIMITS.DEFAULT_PAGE_SIZE;
    
//     // Map locationValue to location for API compatibility
//     if (cleaned.locationValue) {
//       cleaned.location = cleaned.locationValue;
//     }
    
//     // Remove undefined values
//     Object.keys(cleaned).forEach(key => {
//       if (cleaned[key] === undefined) {
//         delete cleaned[key];
//       }
//     });
    
//     return cleaned;
//   }

//   static validateMessage(message) {
//     if (!message) {
//       throw new Error('Message is required');
//     }
    
//     if (typeof message !== 'string') {
//       throw new Error('Message must be a string');
//     }
    
//     if (message.trim().length === 0) {
//       throw new Error('Message cannot be empty');
//     }
    
//     return message.trim();
//   }

//   static buildResponse(originalMessage, aiResponse, properties, totalFound, pagination = null) {
//     const response = {
//       message: originalMessage,
//       aiExplanation: aiResponse.explanation,
//       extractedFilters: aiResponse.filters,
//       properties,
//       totalFound: totalFound || 0,
//       returned: properties.length,
//       timestamp: new Date().toISOString()
//     };

//     // Add pagination info if available
//     if (pagination) {
//       response.pagination = pagination;
//     }

//     return response;
//   }
// }

// module.exports = FilterUtils;