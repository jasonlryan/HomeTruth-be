// const axios = require('axios');
// const qs = require('qs');
// const { ZOOPLA } = require('./constants');

// class ZooplaService {
//   constructor() {
//     this.baseURL = ZOOPLA.BASE_URL;
//     this.clientId = ZOOPLA.CLIENT_ID;
//     this.clientSecret = ZOOPLA.CLIENT_SECRET;
//     this.agencyRef = ZOOPLA.AGENCY_REF;
//   }

//   async getAccessToken() {
//     try {
//       const url = `${this.baseURL}${ZOOPLA.ENDPOINTS.TOKEN}`;
//       const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
//       const headers = {
//         'Content-Type': 'application/x-www-form-urlencoded',
//         'Authorization': `Basic ${credentials}`
//       };
      
//       const data = qs.stringify({ grant_type: 'client_credentials' });
//       const res = await axios.post(url, data, { headers });
      
//       return res.data.access_token;
//     } catch (error) {
//       console.error('Failed to get access token:', error);
//       throw new Error('Authentication failed');
//     }
//   }

//   async searchProperties(token, filters) {
//     try {
//       const url = `${this.baseURL}${ZOOPLA.ENDPOINTS.INVENTORY}`;
//       const headers = this._getAuthHeaders(token);
      
//       console.log('Searching with filters:', filters);
//       const res = await axios.get(url, { headers, params: filters });
      
//       // Return both items and total count from API response
//       return {
//         items: res.data.items || [],
//         totalResults: res.data.totalResults || res.data.total || res.data.count || (res.data.items ? res.data.items.length : 0),
//         pagination: res.data.pagination || null
//       };
//     } catch (error) {
//       console.error('Failed to search properties:', error);
//       throw new Error('Property search failed');
//     }
//   }

//   async getPropertyDetails(token, propertyId) {
//     try {
//       const url = `${this.baseURL}${ZOOPLA.ENDPOINTS.INVENTORY}/${propertyId}`;
//       const headers = this._getAuthHeaders(token);
      
//       const res = await axios.get(url, { headers });
//       return res.data;
//     } catch (error) {
//       console.error(`Failed to get property details for ${propertyId}:`, error);
//       throw new Error(`Failed to get property details`);
//     }
//   }

//   async getPropertyImages(token, propertyId) {
//     try {
//       const url = `${this.baseURL}${ZOOPLA.ENDPOINTS.PROPERTY_IMAGES}/${propertyId}/images`;
//       const headers = this._getAuthHeaders(token);
      
//       const res = await axios.get(url, { headers });
//       return res.data.galleryImages || [];
//     } catch (error) {
//       console.error(`Failed to get images for property ${propertyId}:`, error);
//       return []; // Return empty array instead of throwing
//     }
//   }

//   async downloadImage(token, propertyId, imageId) {
//     try {
//       const url = `${this.baseURL}${ZOOPLA.ENDPOINTS.PROPERTY_IMAGES}/${propertyId}/images/${imageId}`;
//       const headers = {
//         ...this._getAuthHeaders(token),
//         'Accept': 'image/jpeg'
//       };
      
//       const res = await axios.get(url, { headers, responseType: 'stream' });
//       return res.data;
//     } catch (error) {
//       console.error(`Failed to download image ${imageId}:`, error);
//       throw new Error('Image download failed');
//     }
//   }

//   _getAuthHeaders(token) {
//     return {
//       'Authorization': `Bearer ${token}`,
//       'AgencyRef': this.agencyRef
//     };
//   }
// }

// module.exports = new ZooplaService();