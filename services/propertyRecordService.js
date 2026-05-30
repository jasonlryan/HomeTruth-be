const crypto = require("crypto");
const {
  Property,
  PropertyAddress,
  PropertyPerson,
} = require("../models");
const sequelize = require("../config/database");
const PropertyDocumentService = require("./propertyDocumentService");
const PropertyFactService = require("./propertyFactService");

const PROPERTY_TYPES = new Set([
  "house",
  "flat",
  "maisonette",
  "bungalow",
  "commercial",
  "land",
  "mixed_use",
  "unknown",
]);

const TENURES = new Set([
  "freehold",
  "leasehold",
  "share_of_freehold",
  "commonhold",
  "unknown",
]);

const RELATIONSHIP_TYPES = new Set([
  "owner",
  "buyer",
  "seller",
  "landlord",
  "tenant",
  "investor",
  "agent",
  "manager",
  "contractor",
  "lender",
  "insurer",
  "viewer",
  "other",
]);

const MANAGE_PERMISSION_LEVELS = new Set(["manage", "admin"]);

class PropertyRecordError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PropertyRecordError";
    this.statusCode = statusCode;
  }
}

const requireValue = (value, message) => {
  if (value === undefined || value === null || value === "") {
    throw new PropertyRecordError(message, 400);
  }
};

const normalizePostcode = (postcode) =>
  typeof postcode === "string" ? postcode.trim().toUpperCase() : postcode;

const normalizeAddressFingerprint = (address) => {
  const parts = [
    address.address_line_1,
    address.address_line_2,
    address.town_city,
    address.county,
    address.postcode,
    address.country,
  ]
    .filter(Boolean)
    .map((part) => String(part).trim().toLowerCase());

  if (!parts.length) return null;
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
};

const toPropertyResponse = (property) => ({
  id: property.id,
  uprn: property.uprn,
  propertyType: property.property_type,
  tenure: property.tenure,
  lifecycleStatus: property.lifecycle_status,
  sourceType: property.source_type,
  sourceRef: property.source_ref,
  createdByUserId: property.created_by_user_id,
  createdAt: property.createdAt,
  updatedAt: property.updatedAt,
});

const toAddressResponse = (address) => {
  if (!address) return null;

  return {
    id: address.id,
    propertyId: address.property_id,
    isCurrent: address.is_current,
    addressLine1: address.address_line_1,
    addressLine2: address.address_line_2,
    townCity: address.town_city,
    county: address.county,
    postcode: address.postcode,
    country: address.country,
    latitude: address.latitude,
    longitude: address.longitude,
    sourceType: address.source_type,
    confidence: address.confidence,
    validFrom: address.valid_from,
    validTo: address.valid_to,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
};

const toRelationshipResponse = (relationship) => {
  if (!relationship) return null;

  return {
    id: relationship.id,
    propertyId: relationship.property_id,
    userId: relationship.user_id,
    relationshipType: relationship.relationship_type,
    relationshipStatus: relationship.relationship_status,
    permissionLevel: relationship.permission_level,
    isPrimary: relationship.is_primary,
    startDate: relationship.start_date,
    endDate: relationship.end_date,
    verificationStatus: relationship.verification_status,
    sourceType: relationship.source_type,
    sourceRef: relationship.source_ref,
    createdAt: relationship.createdAt,
    updatedAt: relationship.updatedAt,
  };
};

const toPropertyPayload = (payload = {}, userId) => {
  const propertyType = payload.propertyType || "unknown";
  const tenure = payload.tenure || "unknown";

  if (!PROPERTY_TYPES.has(propertyType)) {
    throw new PropertyRecordError(`Unsupported propertyType: ${propertyType}`);
  }

  if (!TENURES.has(tenure)) {
    throw new PropertyRecordError(`Unsupported tenure: ${tenure}`);
  }

  return {
    uprn: payload.uprn || null,
    property_type: propertyType,
    tenure,
    lifecycle_status: "active",
    source_type: payload.sourceType || "manual",
    source_ref: payload.sourceRef || null,
    created_by_user_id: userId,
  };
};

const toAddressPayload = (payload = {}) => {
  requireValue(payload.addressLine1, "address.addressLine1 is required");

  const address = {
    is_current: true,
    address_line_1: payload.addressLine1,
    address_line_2: payload.addressLine2 || null,
    town_city: payload.townCity || null,
    county: payload.county || null,
    postcode: normalizePostcode(payload.postcode || null),
    country: payload.country || "GB",
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    source_type: payload.sourceType || "manual",
    confidence: payload.confidence ?? null,
    valid_from: payload.validFrom || null,
    valid_to: payload.validTo || null,
  };

  address.address_fingerprint = normalizeAddressFingerprint(address);
  return address;
};

const buildProfile = async (property, relationship, options = {}) => {
  const [currentAddress, linkedDocuments, currentFactSummary] =
    await Promise.all([
      PropertyAddress.findOne({
        where: {
          property_id: property.id,
          is_current: true,
        },
        order: [["updatedAt", "DESC"]],
        transaction: options.transaction,
      }),
      PropertyDocumentService.listLinkedDocumentsForProperty(property.id, {
        transaction: options.transaction,
      }),
      PropertyFactService.listCurrentFactsForProperty(property.id, {
        transaction: options.transaction,
      }),
    ]);

  return {
    property: toPropertyResponse(property),
    currentAddress: toAddressResponse(currentAddress),
    relationship: toRelationshipResponse(relationship),
    linkedDocumentCount: linkedDocuments.length,
    linkedDocuments,
    currentFacts: currentFactSummary.facts,
    currentFactsByNamespace: currentFactSummary.groupedFacts,
  };
};

const getActiveRelationship = async (propertyId, userId) =>
  PropertyPerson.findOne({
    where: {
      property_id: propertyId,
      user_id: userId,
      relationship_status: "active",
    },
  });

class PropertyRecordService {
  static async createPropertyRecord(userId, payload) {
    requireValue(payload?.relationshipType, "relationshipType is required");

    if (!RELATIONSHIP_TYPES.has(payload.relationshipType)) {
      throw new PropertyRecordError(
        `Unsupported relationshipType: ${payload.relationshipType}`
      );
    }

    return sequelize.transaction(async (transaction) => {
      const property = await Property.create(toPropertyPayload(payload, userId), {
        transaction,
      });

      await PropertyAddress.create(
        {
          ...toAddressPayload(payload.address),
          property_id: property.id,
        },
        { transaction }
      );

      const relationship = await PropertyPerson.create(
        {
          property_id: property.id,
          user_id: userId,
          relationship_type: payload.relationshipType,
          relationship_status: "active",
          permission_level: "admin",
          is_primary: true,
          verification_status: "user_confirmed",
          source_type: "manual",
        },
        { transaction }
      );

      return buildProfile(property, relationship, { transaction });
    });
  }

  static async listPropertyRecords(userId) {
    const relationships = await PropertyPerson.findAll({
      where: {
        user_id: userId,
        relationship_status: "active",
      },
      include: [
        {
          model: Property,
          required: true,
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    return Promise.all(
      relationships.map((relationship) =>
        buildProfile(relationship.Property, relationship)
      )
    );
  }

  static async getPropertyRecord(userId, propertyId) {
    const relationship = await getActiveRelationship(propertyId, userId);
    if (!relationship) {
      throw new PropertyRecordError("Property record not found", 404);
    }

    const property = await Property.findByPk(propertyId);
    if (!property) {
      throw new PropertyRecordError("Property record not found", 404);
    }

    return buildProfile(property, relationship);
  }

  static async updatePropertyRecord(userId, propertyId, payload) {
    const relationship = await getActiveRelationship(propertyId, userId);
    if (!relationship) {
      throw new PropertyRecordError("Property record not found", 404);
    }

    if (!MANAGE_PERMISSION_LEVELS.has(relationship.permission_level)) {
      throw new PropertyRecordError(
        "You do not have permission to update this property",
        403
      );
    }

    return sequelize.transaction(async (transaction) => {
      const property = await Property.findByPk(propertyId, { transaction });
      if (!property) {
        throw new PropertyRecordError("Property record not found", 404);
      }

      const propertyUpdates = {};

      if (payload.uprn !== undefined) propertyUpdates.uprn = payload.uprn || null;
      if (payload.propertyType !== undefined) {
        if (!PROPERTY_TYPES.has(payload.propertyType)) {
          throw new PropertyRecordError(
            `Unsupported propertyType: ${payload.propertyType}`
          );
        }
        propertyUpdates.property_type = payload.propertyType;
      }
      if (payload.tenure !== undefined) {
        if (!TENURES.has(payload.tenure)) {
          throw new PropertyRecordError(`Unsupported tenure: ${payload.tenure}`);
        }
        propertyUpdates.tenure = payload.tenure;
      }

      if (Object.keys(propertyUpdates).length) {
        await property.update(propertyUpdates, { transaction });
      }

      if (payload.address) {
        const addressUpdates = toAddressPayload(payload.address);
        const currentAddress = await PropertyAddress.findOne({
          where: {
            property_id: property.id,
            is_current: true,
          },
          transaction,
        });

        if (currentAddress) {
          await currentAddress.update(addressUpdates, { transaction });
        } else {
          await PropertyAddress.create(
            {
              ...addressUpdates,
              property_id: property.id,
            },
            { transaction }
          );
        }
      }

      await property.reload({ transaction });
      return buildProfile(property, relationship, { transaction });
    });
  }
}

PropertyRecordService.PropertyRecordError = PropertyRecordError;

module.exports = PropertyRecordService;
