// const openaiService = require('./opeanaiService');
// const zooplaService = require('./zooplaService');
// const imageService = require('./imageService');
// const FilterUtils = require('./filterUtils');
// const { LIMITS } = require('./constants');

// class PropertyController {
//   async getProperties(req, res) {
//     try {
//       // Extract and validate message from request
//       const message = this._extractMessage(req);
//       // console.log('User message:', message);
      
//       // Step 1: Extract filters using OpenAI
//       const aiResponse = await openaiService.extractFiltersFromMessage(message);
//       // console.log('Extracted filters:', aiResponse.filters);
//       // console.log('AI Explanation:', aiResponse.explanation);
      
//       // Step 2: Clean and prepare filters for Zoopla API
//       const cleanedFilters = FilterUtils.cleanFilters(aiResponse.filters);
      
//       // Step 3: Search properties
//       const token = await zooplaService.getAccessToken();
//       const searchResult = await zooplaService.searchProperties(token, cleanedFilters);
      
//       // console.log('Search result:', {
//       //   itemsFound: searchResult.items.length,
//       //   totalResults: searchResult.totalResults,
//       //   pagination: searchResult.pagination
//       // });
      
//       // Step 4: Handle no results
//       if (!searchResult.items || searchResult.items.length === 0) {
//         const emptyResponse = FilterUtils.buildResponse(message, aiResponse, [], searchResult.totalResults);
//         return res.json(emptyResponse);
//       }
      
//       // Step 5: Get detailed property information
//       const properties = await this._enrichPropertiesWithDetails(token, searchResult.items);
      
//       // Step 6: Build and return response with correct total count
//       const response = FilterUtils.buildResponse(message, aiResponse, properties, searchResult.totalResults);
//       res.json(response);
      
//     } catch (error) {
//       this._handleError(res, error);
//     }
//   }

//   async _enrichPropertiesWithDetails(token, items) {
//     const properties = [];
//     const maxProperties = Math.min(items.length, LIMITS.MAX_PROPERTIES);
    
//     for (let i = 0; i < maxProperties; i++) {
//       const item = items[i];
      
//       try {
//         const property = await this._getPropertyWithImages(token, item.id);
//         if (property) {
//           properties.push(property);
//         }
//       } catch (error) {
//         console.error(`Failed to process property ${item.id}:`, error.message);
//         // Continue with other properties instead of failing completely
//       }
//     }
    
//     return properties;
//   }

//   async _getPropertyWithImages(token, propertyId) {
//     try {
//       // Get property details and images in parallel
//       const [details, images] = await Promise.all([
//         zooplaService.getPropertyDetails(token, propertyId),
//         zooplaService.getPropertyImages(token, propertyId)
//       ]);
      
//       // Download images
//       const localImages = await imageService.downloadPropertyImages(token, propertyId, images);
      
//       // Attach images to property details
//       details.localImages = localImages;
//       details.totalImages = images.length;
      
//       return details;
//     } catch (error) {
//       console.error(`Error processing property ${propertyId}:`, error);
//       return null;
//     }
//   }

//   _extractMessage(req) {
//     // Support both GET (query params) and POST (body) requests
//     const message = req.body?.message || req.query?.message;
//     return FilterUtils.validateMessage(message);
//   }

//   _handleError(res, error) {
//     console.error('Property controller error:', error);
    
//     // Determine appropriate status code
//     const statusCode = error.message.includes('required') || 
//                       error.message.includes('must be') ? 400 : 500;
    
//     res.status(statusCode).json({
//       error: 'Failed to process property search',
//       message: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// }

// // Export singleton instance
// module.exports = new PropertyController();