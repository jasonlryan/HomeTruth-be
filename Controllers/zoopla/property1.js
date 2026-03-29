const path = require('path');
const fs = require('fs');
const axios = require('axios');
const qs = require('qs');
const { URL } = require('url');
const { OpenAI } = require('openai');
const { zodResponseFormat } = require('openai/helpers/zod');
const { z } = require('zod');
const { BookmarkedListing } = require('../../models/index');
const env = require('../../config/env');


const CLIENT_ID = '3pr0o0r8hgnut1kathv8hq8spr';
const CLIENT_SECRET = 'ej45hmuaol1vvkouqlvnadrm9ddbncghndnk7gtllclbrq3ae74';
const AGENCY_REF = '9447fee7-25a2-46f7-bfeb-30d373a66cc6';
const TEMP_DIR = path.join(__dirname, '../../temp-images');
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'https://b081ce4881c5.ngrok-free.app';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Zod schemas for OpenAI structured response
const ZooplaFilterSchema = z.object({
  locationValue: z.string(),
  locationIdentifier: z.string(),
  category: z.enum(["residential", "commercial", "any"]),
  furnishedState: z.enum(["any", "furnished", "part_furnished", "unfurnished"]),
  includeRented: z.boolean(),
  includeRetirementHomes: z.boolean(),
  includeSharedAccommodation: z.boolean(),
  includeSharedOwnership: z.boolean(),
  includeSold: z.boolean(),
  isAuction: z.boolean(),
  petsAllowed: z.boolean(),
  billsIncluded: z.boolean(),
  keywords: z.string(),
  section: z.enum(["for-sale", "to-rent"]),
  bedsMax: z.number(),
  bedsMin: z.number(),
  priceMax: z.number(),
  priceMin: z.number(),
  sortOrder: z.enum(["newest_listings", "highest_price", "lowest_price", "most_reduced", "none"]),
  page: z.number(),
  radius: z.number(),
  priceFrequency: z.enum(["per_month", "per_year", "none"]),
  newHomes: z.enum(["only", "exclude", "any"]),
  added: z.enum(["24_hours", "3_days", "7_days", "14_days", "30_days", "any"]),
  propertySubType: z.string(),
  chainFree: z.boolean(),
  reducedPriceOnly: z.boolean(),
  feature: z.string(),
  tenure: z.string(),
  smartTags: z.string(),
  pageSize: z.number()
});

const ZooplaResponseSchema = z.object({
  filters: ZooplaFilterSchema,
  explanation: z.string()
});

async function getAccessToken() {
  const url = 'https://api.alto.zoopladev.co.uk/token';
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${credentials}`
  };
  const data = qs.stringify({ grant_type: 'client_credentials' });
  
  const res = await axios.post(url, data, { headers });
  return res.data.access_token;
}

async function extractFiltersWithOpenAI(message) {
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `
You are a helpful assistant that extracts structured Zoopla-style search filters from natural language user prompts.

IMPORTANT: You MUST provide values for ALL fields in the response. Use sensible defaults for unspecified fields.

Your job is to:
1. Extract explicit filters like bedrooms, prices, location, and type of listing.
2. Infer implicit preferences from the user's language.
3. Provide sensible defaults for all unspecified fields.

REQUIRED FIELDS AND DEFAULTS:
- locationValue: The location name (e.g., "Oxford")
- locationIdentifier: The location identifier (e.g., "oxford")
- category: "residential", "commercial", or "any" (default: "residential")
- furnishedState: "any", "furnished", "part_furnished", "unfurnished" (default: "any")
- includeRented: true/false (default: false)
- includeRetirementHomes: true/false (default: false)
- includeSharedAccommodation: true/false (default: false)
- includeSharedOwnership: true/false (default: false)
- includeSold: true/false (default: false)
- isAuction: true/false (default: false)
- petsAllowed: true/false (default: false unless mentioned)
- billsIncluded: true/false (default: false)
- keywords: String of relevant keywords (empty string if none)
- section: "for-sale" or "to-rent" (infer from context, default: "for-sale")
- bedsMin: Minimum bedrooms (0 if not specified)
- bedsMax: Maximum bedrooms (0 if not specified, 10 if "many" bedrooms mentioned)
- priceMin: Minimum price (0 if not specified)
- priceMax: Maximum price (0 if not specified)
- sortOrder: "newest_listings", "highest_price", "lowest_price", "most_reduced", "none" (default: "none")
- page: Page number (default: 1)
- radius: Search radius in miles (default: 5)
- priceFrequency: "per_month", "per_year", "none" (default: "none")
- newHomes: "only", "exclude", "any" (default: "any")
- added: "24_hours", "3_days", "7_days", "14_days", "30_days", "any" (default: "any")
- propertySubType: Property subtype (empty string if not specified)
- chainFree: true/false (default: false)
- reducedPriceOnly: true/false (default: false)
- feature: Special features (empty string if none)
- tenure: Property tenure (empty string if not specified)
- smartTags: Smart tags (empty string if none)
- pageSize: Results per page (default: 28)

INFERENCE RULES:
- "kids", "family", "school", "park" → keywords: "family friendly, near schools, near parks"
- "budget", "cheap", "affordable" → set appropriate price ranges
- "rent", "rental", "to let" → section: "to-rent"
- "buy", "purchase", "for sale" → section: "for-sale"
- "pets", "dog", "cat" → petsAllowed: true
- "furnished" → furnishedState: "furnished"

Example:
Input: "I have two kids and want to rent a 3-bed house in Oxford under £2000/month"
Output:
{
  filters: {
    locationValue: "Oxford",
    locationIdentifier: "oxford",
    category: "residential",
    furnishedState: "any",
    includeRented: false,
    includeRetirementHomes: false,
    includeSharedAccommodation: false,
    includeSharedOwnership: false,
    includeSold: false,
    isAuction: false,
    petsAllowed: false,
    billsIncluded: false,
    keywords: "family friendly",
    section: "to-rent",
    bedsMin: 3,
    bedsMax: 3,
    priceMin: 0,
    priceMax: 2000,
    sortOrder: "none",
    page: 1,
    radius: 5,
    priceFrequency: "per_month",
    newHomes: "any",
    added: "any",
    propertySubType: "",
    chainFree: false,
    reducedPriceOnly: false,
    feature: "",
    tenure: "",
    smartTags: "",
    pageSize: 28
  },
  explanation: "User wants to rent a 3-bedroom house in Oxford for under £2000/month, family-friendly due to having children."
}
`
        },
        { role: 'user', content: message },
      ],
      response_format: zodResponseFormat(ZooplaResponseSchema, 'filters_extracted'),
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error('OpenAI extraction error:', error);
    // Fallback with all required fields
    return {
      filters: {
        locationValue: "Oxford",
        locationIdentifier: "oxford",
        category: "residential",
        furnishedState: "any",
        includeRented: false,
        includeRetirementHomes: false,
        includeSharedAccommodation: false,
        includeSharedOwnership: false,
        includeSold: false,
        isAuction: false,
        petsAllowed: false,
        billsIncluded: false,
        keywords: "",
        section: "for-sale",
        bedsMin: 0,
        bedsMax: 0,
        priceMin: 0,
        priceMax: 0,
        sortOrder: "none",
        page: 1,
        radius: 5,
        priceFrequency: "none",
        newHomes: "any",
        added: "any",
        propertySubType: "",
        chainFree: false,
        reducedPriceOnly: false,
        feature: "",
        tenure: "",
        smartTags: "",
        pageSize: 28
      },
      explanation: "Failed to parse user message, using default Oxford search"
    };
  }
}

// Updated cleanFilters function to handle the new required structure
function cleanFilters(filters) {
  const cleaned = { ...filters };
  
  // Clean up numeric filters - remove if 0, set sensible defaults
  cleaned.bedsMin = filters.bedsMin > 0 ? filters.bedsMin : undefined;
  cleaned.bedsMax = filters.bedsMax > 0 ? filters.bedsMax : undefined;
  cleaned.priceMin = filters.priceMin > 0 ? filters.priceMin : undefined;
  cleaned.priceMax = filters.priceMax > 0 ? filters.priceMax : undefined;
  cleaned.radius = filters.radius > 0 ? filters.radius : 5;
  cleaned.page = filters.page > 0 ? filters.page : 1;
  cleaned.pageSize = filters.pageSize > 0 ? filters.pageSize : 28;
  
  // Handle enum defaults - remove if set to "any", "none", etc.
  if (cleaned.category === "any") delete cleaned.category;
  if (cleaned.furnishedState === "any") delete cleaned.furnishedState;
  if (cleaned.sortOrder === "none") delete cleaned.sortOrder;
  if (cleaned.priceFrequency === "none") delete cleaned.priceFrequency;
  if (cleaned.newHomes === "any") delete cleaned.newHomes;
  if (cleaned.added === "any") delete cleaned.added;
  
  // Handle boolean defaults - only include if true
  if (!cleaned.includeRented) delete cleaned.includeRented;
  if (!cleaned.includeRetirementHomes) delete cleaned.includeRetirementHomes;
  if (!cleaned.includeSharedAccommodation) delete cleaned.includeSharedAccommodation;
  if (!cleaned.includeSharedOwnership) delete cleaned.includeSharedOwnership;
  if (!cleaned.includeSold) delete cleaned.includeSold;
  if (!cleaned.isAuction) delete cleaned.isAuction;
  if (!cleaned.petsAllowed) delete cleaned.petsAllowed;
  if (!cleaned.billsIncluded) delete cleaned.billsIncluded;
  if (!cleaned.chainFree) delete cleaned.chainFree;
  if (!cleaned.reducedPriceOnly) delete cleaned.reducedPriceOnly;
  
  // Handle empty strings
  if (!cleaned.keywords || cleaned.keywords.trim() === "") delete cleaned.keywords;
  if (!cleaned.propertySubType || cleaned.propertySubType.trim() === "") delete cleaned.propertySubType;
  if (!cleaned.feature || cleaned.feature.trim() === "") delete cleaned.feature;
  if (!cleaned.tenure || cleaned.tenure.trim() === "") delete cleaned.tenure;
  if (!cleaned.smartTags || cleaned.smartTags.trim() === "") delete cleaned.smartTags;
  
  // Map locationValue to location for API compatibility
  cleaned.location = cleaned.locationValue;
  
  // Remove undefined values
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  
  return cleaned;
}


async function searchProperties(token, filters) {
  const url = 'https://api.alto.zoopladev.co.uk/inventory';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'AgencyRef': AGENCY_REF
  };
  
  const cleanedFilters = cleanFilters(filters);
  // console.log('Searching with filters:', cleanedFilters);
  
  const res = await axios.get(url, { headers, params: cleanedFilters });
  return res.data.items;
}

async function getPropertyDetails(token, propertyId) {
  const url = `https://api.alto.zoopladev.co.uk/inventory/${propertyId}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'AgencyRef': AGENCY_REF
  };
  const res = await axios.get(url, { headers });
  return res.data;
}

async function getPropertyImages(token, propertyId) {
  const url = `https://api.alto.zoopladev.co.uk/listing/property/${propertyId}/images`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'AgencyRef': AGENCY_REF
  };
  const res = await axios.get(url, { headers });
  return res.data.galleryImages || [];
}

async function downloadImageToTemp(token, propertyId, imageId) {
  const url = `https://api.alto.zoopladev.co.uk/listing/property/${propertyId}/images/${imageId}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'AgencyRef': AGENCY_REF,
    'Accept': 'image/jpeg'
  };
  const res = await axios.get(url, { headers, responseType: 'stream' });
  const savePath = path.join(TEMP_DIR, `${imageId}.jpg`);
  const writer = fs.createWriteStream(savePath);
  res.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  // Return full URL for client consumption
  return `${SERVER_BASE_URL}/temp-images/${imageId}.jpg`;
}

async function bookmarkPropertyImage(token, propertyId) {
  const images = await getPropertyImages(token, propertyId);
  const localImages = [];

  const maxImages = Math.min(images.length, 5);
  for (let j = 0; j < maxImages; j++) {
    const img = images[j];
    const url = img?.sizes?.screen?.src;
    if (!url) continue;

    const imageId = new URL(url).pathname.split('/').pop();
    if (!/^[0-9]+$/.test(imageId)) continue;

    try {
      const localUrl = await downloadImageToTemp(token, propertyId, imageId);
      localImages.push(localUrl);
    } catch (imgError) {
      console.error(`Failed to download image ${imageId}:`, imgError.message);
    }
  }

  return localImages;
}

async function bookmarkProperty(req, res) {
  const userId = req.user?.id;
  const { propertyId } = req.body;

  if (!propertyId || !userId) {
    return res.status(400).json({ error: 'propertyId and userId are required' });
  }

  try {
    const token = await getAccessToken();
    const details = await getPropertyDetails(token, propertyId);
    
    let bookmarkData = {
      user_id: userId,
      property_id: propertyId,
      property_details: details
    };

    // Handle images based on environment
    if (env.nodeEnv === 'development') {
      // In development: save images to file and store paths
      const imagePaths = await bookmarkPropertyImage(token, propertyId);
      bookmarkData.property_details.localImages = imagePaths;
    } else if (env.nodeEnv === 'production') {
      // In production: just save the data, images will be fetched dynamically
      // No need to download images at bookmark time
    }

    await BookmarkedListing.create(bookmarkData);

    res.json({ message: 'Property BookmarkedListing successfully', propertyId });
  } catch (err) {
    console.error('Error bookmarking property:', err.message);
    res.status(500).json({ error: 'Failed to bookmark property', details: err.message });
  }
}

async function getBookmarkedListingProperties(req, res) {
  const userId = req.user?.id;

  try {
    const bookmarks = await BookmarkedListing.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']]
    }); 

    // Handle images based on environment
    if (env.nodeEnv === 'production') {
      // In production: fetch images dynamically for each bookmark
      const token = await getAccessToken();
      
      for (let bookmark of bookmarks) {
        try {
          const propertyId = bookmark.property_id;
          const imagePaths = await bookmarkPropertyImage(token, propertyId);
          bookmark.property_details.localImages = imagePaths;
        } catch (imgError) {
          console.error(`Failed to fetch images for property ${bookmark.property_id}:`, imgError.message);
          bookmark.property_details.localImages = [];
        }
      }
    }
    // In development: images are already saved in property_details.localImages

    res.json({
      total: bookmarks.length,
      bookmarks
    });
  } catch (err) {
    console.error('Error fetching bookmarks:', err.message);
    res.status(500).json({ error: 'Failed to fetch bookmarks', details: err.message });
  }
}

async function getProperties(req, res) {
  try {
    const message = req.body?.message || req.query?.message;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required in request body' 
      });
    }

    console.log('User message:', message);

    const { filters, explanation } = await extractFiltersWithOpenAI(message);
    console.log('Extracted filters:', filters);

    const token = await getAccessToken();
    const items = await searchProperties(token, filters);

    if (!items || items.length === 0) {
      return res.json({
        message,
        aiExplanation: explanation,
        extractedFilters: filters,
        properties: [],
        totalFound: 0
      });
    }

    const results = [];
    const maxProperties = Math.min(items.length, 10);

    for (let i = 0; i < maxProperties; i++) {
      const item = items[i];
      const id = item.id;

      try {
        const details = await getPropertyDetails(token, id);
        const images = await getPropertyImages(token, id);
        const localImages = [];

        const maxImages = Math.min(images.length, 5);
        for (let j = 0; j < maxImages; j++) {
          const img = images[j];
          const url = img?.sizes?.screen?.src;
          if (!url) continue;

          const imageId = new URL(url).pathname.split('/').pop();
          if (!/^[0-9]+$/.test(imageId)) continue;

          try {
            const localUrl = await downloadImageToTemp(token, id, imageId);
            localImages.push(localUrl);
          } catch (imgError) {
            console.error(`Failed to download image ${imageId}:`, imgError.message);
          }
        }

        details.localImages = localImages;
        results.push(details);
      } catch (propertyError) {
        console.error(`Failed to get details for property ${id}:`, propertyError.message);
      }
    }

    const response = {
      message,
      aiExplanation: explanation,
      extractedFilters: filters,
      properties: results,
      totalFound: items.length,
      returned: results.length
    };

    res.json(response);
  } catch (err) {
    console.error('Controller error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch property data',
      details: err.message 
    });
  }
}


module.exports = {
  bookmarkProperty,
  getBookmarkedListingProperties,
  getProperties
};