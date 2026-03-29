// const { z } = require('zod');

// const ZooplaFilterSchema = z.object({
//   locationValue: z.string(),
//   locationIdentifier: z.string(),
//   category: z.enum(["residential", "commercial"]).optional(),
//   furnishedState: z.enum(["Any", "furnished", "part_furnished", "unfurnished"]).optional(),
//   includeRented: z.boolean().optional(),
//   includeRetirementHomes: z.boolean().optional(),
//   includeSharedAccommodation: z.boolean().optional(),
//   includeSharedOwnership: z.boolean().optional(),
//   includeSold: z.boolean().optional(),
//   isAuction: z.boolean().optional(),
//   petsAllowed: z.boolean().optional(),
//   billsIncluded: z.boolean().optional(),
//   keywords: z.string().optional(),
//   section: z.enum(["for-sale", "to-rent"]).optional(),
//   bedsMax: z.number().optional(),
//   bedsMin: z.number().optional(),
//   priceMax: z.number().optional(),
//   priceMin: z.number().optional(),
//   sortOrder: z.enum(["newest_listings", "highest_price", "lowest_price", "most_reduced"]).optional(),
//   page: z.number().optional(),
//   radius: z.number().optional(),
//   priceFrequency: z.enum(["per_month", "per_year"]).optional(),
//   newHomes: z.enum(["only", "exclude"]).optional(),
//   added: z.enum(["24_hours", "3_days", "7_days", "14_days", "30_days"]).optional(),
//   propertySubType: z.string().optional(),
//   chainFree: z.boolean().optional(),
//   reducedPriceOnly: z.boolean().optional(),
//   feature: z.string().optional(),
//   tenure: z.string().optional(),
//   smartTags: z.string().optional(),
//   pageSize: z.number().optional()
// });

// const ZooplaResponseSchema = z.object({
//   filters: ZooplaFilterSchema,
//   explanation: z.string()
// });

// module.exports = {
//   ZooplaFilterSchema,
//   ZooplaResponseSchema
// };